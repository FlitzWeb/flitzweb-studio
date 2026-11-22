import AppKit
import WebKit

/// The Studio in its own window. The page is the live site, so a deploy shows up here without a
/// new build of the app. The sign-in cookie is kept by WebKit for this app only (not shared with
/// Safari or Chrome). Links to other sites open in the browser, downloads go to Downloads.
final class StudioWindow: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let window: NSWindow
    let webView: WKWebView
    private let hint = Hint()
    private weak var intro: Intro?
    private var observations: [NSKeyValueObservation] = []
    private var loaded = false
    private var downloads: [ObjectIdentifier: URL] = [:]

    /// Called after every finished page load (the snapshot test mode waits for it).
    var onLoaded: () -> Void = {}

    /// The Studio's own dark background, shown until the page has drawn.
    private static let night = NSColor(srgbRed: 0x06 / 255.0, green: 0x09 / 255.0, blue: 0x13 / 255.0, alpha: 1)

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "FlitzWebStudioMac/0.1"
        config.preferences.isElementFullscreenEnabled = true
        // The page stops dead at its top and bottom, like an app, instead of stretching past
        // them and springing back. Added as a sheet of its own, so the page's own markup (which
        // React checks against the server's) is left alone.
        config.userContentController.addUserScript(WKUserScript(source: """
            (() => {
              const css = 'html, body { overscroll-behavior: none; }';
              try {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(css);
                document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
              } catch (error) {
                addEventListener('DOMContentLoaded', () => {
                  const style = document.createElement('style');
                  style.textContent = css;
                  document.head.appendChild(style);
                });
              }
            })()
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let frame = NSRect(x: 0, y: 0, width: 1320, height: 860)
        webView = WKWebView(frame: frame, configuration: config)
        window = NSWindow(contentRect: frame,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.pageZoom = zoom
        // No white flash before the first page: the window's dark background shows through instead.
        webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        // The title bar is a plain strip in the page's own background colour, so the window reads
        // as one surface and the page never sits under the window buttons.
        window.title = "FlitzWeb Studio"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.backgroundColor = Self.night
        window.appearance = NSAppearance(named: .darkAqua)

        // The content runs up behind the title bar, so the opening can cover the whole window; the
        // page itself starts below the title bar (the layout guide), clear of the window buttons.
        let content = NSView(frame: frame)
        window.contentView = content
        webView.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(webView)
        hint.translatesAutoresizingMaskIntoConstraints = false
        hint.isHidden = true
        content.addSubview(hint)
        var constraints = [
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            hint.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            hint.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -28),
        ]
        if let guide = window.contentLayoutGuide as? NSLayoutGuide {
            constraints.append(webView.topAnchor.constraint(equalTo: guide.topAnchor))
        } else {
            constraints.append(webView.topAnchor.constraint(equalTo: content.topAnchor, constant: 28))
        }
        NSLayoutConstraint.activate(constraints)
        window.contentMinSize = NSSize(width: 380, height: 500)
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.delegate = self
        window.center()
        window.setFrameAutosaveName("StudioMain")

        // Follow the page: light or dark theme tints the title bar, the page title names the window.
        observations.append(webView.observe(\.underPageBackgroundColor, options: [.new]) { [weak self] view, _ in
            self?.tint(view.underPageBackgroundColor)
        })
        observations.append(webView.observe(\.title, options: [.new]) { [weak self] view, _ in
            let title = view.title ?? ""
            self?.window.title = title.isEmpty ? "FlitzWeb Studio" : title
        })
        observations.append(webView.observe(\.url, options: [.new]) { [weak self] _, _ in
            self?.updateHint()
        })
    }

    /// Plays the opening over the whole window: once at launch, before the first `show()`, and
    /// again from the menu (`replay`), then over the page that is already there.
    func playIntro(replay: Bool = false) {
        guard intro == nil, replay || !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
              let content = window.contentView,
              let film = Intro(file: Bundle.main.url(forResource: "intro", withExtension: "mp4"))
        else { return }
        film.findPageLogo = { [weak self] found in
            guard let self else { return found(nil) }
            self.findPageLogo(found)
        }
        film.setPageLogoHidden = { [weak self] hidden in
            self?.webView.evaluateJavaScript("""
                document.querySelectorAll('svg[aria-label="FlitzWeb"]').forEach((mark) => { mark.style.opacity = \(hidden ? "'0'" : "''") })
                """)
        }
        film.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(film)
        NSLayoutConstraint.activate([
            film.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            film.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            film.topAnchor.constraint(equalTo: content.topAnchor),
            film.bottomAnchor.constraint(equalTo: content.bottomAnchor),
        ])
        intro = film
        if replay {
            film.pageReady = loaded && !webView.isLoading
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
        }
        film.play()
    }

    /// Where the page's own wordmark is drawn (the `Logo` component: the first one in view), as
    /// the opening needs it: the top left corner of the letters and their width, in the content
    /// view's coordinates.
    private func findPageLogo(_ found: @escaping (Intro.LogoSpot?) -> Void) {
        let script = """
        (() => {
          const marks = [...document.querySelectorAll('svg[aria-label="FlitzWeb"]')];
          const mark = marks.find((m) => {
            const r = m.getBoundingClientRect();
            return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
          });
          if (!mark) return null;
          const r = mark.getBoundingClientRect();
          return [r.left, r.top, r.width, r.height];
        })()
        """
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            guard let self, let box = result as? [Double], box.count == 4 else { return found(nil) }
            // The svg's box is its viewBox (27 36 788 167); the letters start at 28.52, 38.38
            // and are 784.94 wide.
            let left = box[0] + box[2] * 1.52 / 788
            let top = box[1] + box[3] * 2.38 / 167
            let width = box[2] * 784.94 / 788
            let zoom = Double(self.webView.pageZoom)
            let frame = self.webView.frame
            found((topLeft: CGPoint(x: frame.minX + left * zoom, y: frame.maxY - top * zoom), width: width * zoom))
        }
    }

    func show() {
        if !loaded { loaded = true; webView.load(URLRequest(url: Server.url)) }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    func open(_ url: URL) {
        loaded = true
        webView.load(URLRequest(url: url))
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    func reload() {
        if loaded { webView.reload() } else { show() }
    }

    /// Goes to one of the Studio's sections. Clicks the page's own link when there is one (no
    /// full reload), and loads the address otherwise.
    func go(_ path: String) {
        guard loaded else { return open(Server.page(path)) }
        show()
        let script = """
        (() => { const a = document.querySelector('a[href="\(path)"]'); if (!a) return false; a.click(); return true })()
        """
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            if result as? Bool != true { self?.webView.load(URLRequest(url: Server.page(path))) }
        }
    }

    // ---- Zoom (⌘+ ⌘- ⌘0), remembered

    var zoom: CGFloat {
        get {
            let saved = UserDefaults.standard.double(forKey: "pageZoom")
            return saved > 0 ? CGFloat(saved) : 1
        }
        set {
            let value = min(max(newValue, 0.5), 2)
            UserDefaults.standard.set(Double(value), forKey: "pageZoom")
            webView.pageZoom = value
        }
    }

    // ---- Signing in

    /// True on the login page, the only place where ⌘V looks for a login link.
    var isOnLogin: Bool { webView.url.map { Server.owns($0) && $0.path == "/login" } ?? false }

    /// "Check je mail" is on screen: the link in that mail opens the browser when clicked, so say
    /// how to get it into the app instead.
    private func updateHint() {
        let sent = webView.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }?
            .queryItems?.contains { $0.name == "sent" } ?? false
        hint.isHidden = !(isOnLogin && sent)
    }

    private func tint(_ color: NSColor?) {
        guard loaded, let color = color?.usingColorSpace(.sRGB) else { return }
        let light = 0.2126 * color.redComponent + 0.7152 * color.greenComponent + 0.0722 * color.blueComponent > 0.5
        window.backgroundColor = color
        window.appearance = NSAppearance(named: light ? .aqua : .darkAqua)
    }

    // ---- Navigation

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        if action.shouldPerformDownload { return decisionHandler(.download) }
        let scheme = url.scheme?.lowercased() ?? ""
        let inPage = ["about", "blob", "data"].contains(scheme)
        if action.targetFrame?.isMainFrame != false, !Server.owns(url), !inPage {
            // Another site: the browser's job. Only web and mail links, never another app's scheme.
            if ["http", "https", "mailto", "tel"].contains(scheme) { NSWorkspace.shared.open(url) }
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?.lowercased() ?? ""
        decisionHandler(response.canShowMIMEType && !disposition.hasPrefix("attachment") ? .allow : .download)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateHint()
        intro?.pageReady = true
        onLoaded()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        intro?.pageReady = true
        let code = (error as NSError).code
        // Cancelled loads (a link handed to the browser, a download) are not failures.
        guard code != NSURLErrorCancelled, code != 102 else { return }
        let alert = NSAlert()
        alert.messageText = "Studio is niet bereikbaar"
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: "Opnieuw proberen")
        alert.addButton(withTitle: "Sluiten")
        alert.beginSheetModal(for: window) { [weak self] answer in
            if answer == .alertFirstButtonReturn { self?.webView.load(URLRequest(url: Server.url)) }
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // ---- Downloads: straight into the Downloads folder, then shown in Finder

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
        // Only the file's own name: nothing in it may point outside the Downloads folder.
        var name = (suggestedFilename as NSString).lastPathComponent
        if name.isEmpty || name == "." || name == ".." { name = "download" }
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var target = folder.appendingPathComponent(name)
        var count = 2
        while FileManager.default.fileExists(atPath: target.path) {
            target = folder.appendingPathComponent(ext.isEmpty ? "\(base) \(count)" : "\(base) \(count).\(ext)")
            count += 1
        }
        downloads[ObjectIdentifier(download)] = target
        completionHandler(target)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let file = downloads.removeValue(forKey: ObjectIdentifier(download)) {
            NSWorkspace.shared.activateFileViewerSelecting([file])
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
        let alert = NSAlert()
        alert.messageText = "Downloaden is niet gelukt"
        alert.informativeText = error.localizedDescription
        alert.beginSheetModal(for: window)
    }

    // ---- What a browser does for a page: new tabs, dialogs, file pickers

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            let scheme = url.scheme?.lowercased() ?? ""
            if Server.owns(url) { webView.load(action.request) }
            else if ["http", "https", "mailto", "tel"].contains(scheme) { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Annuleer")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        alert.accessoryView = field
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Annuleer")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn ? field.stringValue : nil) }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Server.url.host ? .prompt : .deny)
    }
}

/// The small note at the bottom of the "Check je mail" screen.
final class Hint: NSView {
    init() {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.backgroundColor = NSColor(white: 0.08, alpha: 0.94).cgColor
        layer?.borderWidth = 1
        layer?.borderColor = NSColor(white: 1, alpha: 0.14).cgColor
        let label = NSTextField(labelWithString: "In deze app inloggen: kopieer de link uit de mail en druk hier op ⌘V.")
        label.font = .systemFont(ofSize: 13)
        label.textColor = NSColor(white: 1, alpha: 0.86)
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 9),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -9),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    // Never in the way of the page under it.
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
