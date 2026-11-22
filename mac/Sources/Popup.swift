import AppKit
import WebKit

/// A Studio link that asks for a new tab (the month report's picture) opens in a window of its
/// own, over the main one. Close it with the red button, ⌘W or Esc and the Studio is where it was.
/// In the main window the picture would take the page's place, with no way back but ⌘[.
final class Popup: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    let window: NSWindow
    let webView: WKWebView
    /// Called when the window has closed, so the owner can let go of it.
    var onClose: (Popup) -> Void = { _ in }
    private var titleObservation: NSKeyValueObservation?

    /// `configuration` is the one WebKit hands over for the new tab: the page must be made with it,
    /// and WebKit loads the address into it by itself.
    init(configuration: WKWebViewConfiguration, over parent: NSWindow) {
        let size = NSSize(width: max(420, min(1040, parent.frame.width - 120)),
                          height: max(360, min(780, parent.frame.height - 120)))
        webView = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: configuration)
        window = PopupWindow(contentRect: NSRect(origin: .zero, size: size),
                             styleMask: [.titled, .closable, .miniaturizable, .resizable],
                             backing: .buffered, defer: false)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = true
        webView.setValue(false, forKey: "drawsBackground")
        window.title = "FlitzWeb Studio"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = parent.backgroundColor
        window.appearance = parent.appearance
        window.contentView = webView
        window.contentMinSize = NSSize(width: 320, height: 240)
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.delegate = self
        window.setFrameOrigin(NSPoint(x: parent.frame.midX - size.width / 2, y: parent.frame.midY - size.height / 2))
        titleObservation = webView.observe(\.title, options: [.new]) { [weak self] view, _ in
            if let title = view.title, !title.isEmpty { self?.window.title = title }
        }
    }

    func show() { window.makeKeyAndOrderFront(nil) }

    func windowWillClose(_ notification: Notification) { onClose(self) }

    /// `window.close()` from the page.
    func webViewDidClose(_ webView: WKWebView) { window.close() }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let scheme = url.scheme?.lowercased() ?? ""
        if action.targetFrame?.isMainFrame != false, !Server.owns(url), !["about", "blob", "data"].contains(scheme) {
            // Another site: the browser's job, as in the main window.
            if ["http", "https", "mailto", "tel"].contains(scheme) { NSWorkspace.shared.open(url) }
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    /// A new tab asked for from inside this window: the same page goes there, other sites to the browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            let scheme = url.scheme?.lowercased() ?? ""
            if Server.owns(url) { webView.load(action.request) }
            else if ["http", "https", "mailto", "tel"].contains(scheme) { NSWorkspace.shared.open(url) }
        }
        return nil
    }
}

/// Esc closes it, like a preview.
private final class PopupWindow: NSWindow {
    override func cancelOperation(_ sender: Any?) { performClose(sender) }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { performClose(nil) } else { super.keyDown(with: event) }
    }
}
