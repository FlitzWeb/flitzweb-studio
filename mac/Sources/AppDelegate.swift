import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation {
    private var studio: StudioWindow!

    /// The sections in the Ga menu (⌘1 …). Keep in step with `src/app/(dashboard)/nav.ts`.
    private let sections: [(title: String, path: String)] = [
        ("Overzicht", "/"),
        ("Leads", "/leads"),
        ("Klanten", "/klanten"),
        ("Geld", "/geld"),
    ]

    func applicationDidFinishLaunching(_ notification: Notification) {
        // First of all: the opening film starts loading while the window and the page are set up.
        if !CommandLine.arguments.contains("--no-intro"), !CommandLine.arguments.contains("--snapshot") {
            Intro.warmUp(file: Bundle.main.url(forResource: "intro", withExtension: "mp4"))
        }
        buildMenus()
        studio = StudioWindow()
        // `--open /leads` starts on that page of the Studio instead of the overview.
        let arguments = CommandLine.arguments
        // The opening plays once per launch (not in the test modes).
        if !arguments.contains("--no-intro"), !arguments.contains("--snapshot") { studio.playIntro() }
        if let flag = arguments.firstIndex(of: "--open"), flag + 1 < arguments.count,
           arguments[flag + 1].hasPrefix("/") {
            studio.open(Server.page(arguments[flag + 1]))
        } else {
            studio.show()
        }
        startSnapshotIfAsked()
    }

    /// Closing the window keeps the app in the Dock; a click on the Dock icon brings it back.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        studio.show()
        return true
    }

    /// Right-click on the Dock icon: which sites are offline, by name.
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        guard !studio.sitesDown.isEmpty else { return nil }
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: studio.sitesDown.count == 1 ? "1 site offline" : "\(studio.sitesDown.count) sites offline",
                                action: nil, keyEquivalent: ""))
        for name in studio.sitesDown {
            let entry = NSMenuItem(title: name, action: #selector(showStudio(_:)), keyEquivalent: "")
            entry.target = self
            entry.indentationLevel = 1
            menu.addItem(entry)
        }
        return menu
    }

    // ---- Menu actions

    @objc private func showStudio(_ sender: Any?) { studio.show() }
    @objc private func reload(_ sender: Any?) { studio.reload() }
    @objc private func goBack(_ sender: Any?) { studio.webView.goBack() }
    @objc private func goForward(_ sender: Any?) { studio.webView.goForward() }
    @objc private func zoomIn(_ sender: Any?) { studio.zoom += 0.1 }
    @objc private func zoomOut(_ sender: Any?) { studio.zoom -= 0.1 }
    @objc private func zoomReset(_ sender: Any?) { studio.zoom = 1 }

    @objc private func goToSection(_ sender: NSMenuItem) {
        if let path = sender.representedObject as? String { studio.go(path) }
    }

    /// ⌘V. On the login page a copied login link signs you in here (the link in the mail would
    /// open the browser instead). Everywhere else, and for any other text, it is a normal paste.
    @objc private func smartPaste(_ sender: Any?) {
        if studio.isOnLogin, studio.window.isKeyWindow,
           let text = NSPasteboard.general.string(forType: .string),
           let link = Server.loginLink(in: text) {
            studio.open(link)
            return
        }
        NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: sender)
    }

    @objc private func toggleIntroSound(_ sender: Any?) { Intro.soundOn.toggle() }
    @objc private func replayIntro(_ sender: Any?) { studio.playIntro(replay: true) }

    @objc private func chooseTransition(_ sender: NSMenuItem) {
        if let raw = sender.representedObject as? String, let choice = Intro.Transition(rawValue: raw) {
            Intro.Transition.chosen = choice
        }
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(toggleIntroSound(_:)):
            item.state = Intro.soundOn ? .on : .off
            return true
        case #selector(chooseTransition(_:)):
            item.state = item.representedObject as? String == Intro.Transition.chosen.rawValue ? .on : .off
            return true
        case #selector(goBack(_:)): return studio.webView.canGoBack
        case #selector(goForward(_:)): return studio.webView.canGoForward
        default: return true
        }
    }

    // ---- Menus (in Dutch, like the Studio itself)

    private func buildMenus() {
        let name = "FlitzWeb Studio"
        let main = NSMenu()

        func menu(_ title: String, _ items: [NSMenuItem]) -> NSMenu {
            let holder = NSMenuItem()
            let menu = NSMenu(title: title)
            items.forEach { menu.addItem($0) }
            holder.submenu = menu
            main.addItem(holder)
            return menu
        }
        /// `mine` = handled by this class; otherwise the action goes to whatever has the focus.
        func item(_ title: String, _ action: Selector?, _ key: String = "",
                  _ modifiers: NSEvent.ModifierFlags = .command, mine: Bool = false) -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.keyEquivalentModifierMask = modifiers
            if mine { item.target = self }
            return item
        }

        // How the opening hands over to the page.
        let transitions = NSMenuItem(title: "Overgang", action: nil, keyEquivalent: "")
        transitions.submenu = NSMenu(title: "Overgang")
        for choice in Intro.Transition.allCases {
            let entry = item(choice.title, #selector(chooseTransition(_:)), mine: true)
            entry.representedObject = choice.rawValue
            transitions.submenu?.addItem(entry)
        }

        _ = menu(name, [
            item("Over \(name)", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            item("Speel opening af", #selector(replayIntro(_:)), "o", [.command, .shift], mine: true),
            transitions,
            item("Geluid bij openen", #selector(toggleIntroSound(_:)), mine: true),
            .separator(),
            item("Verberg \(name)", #selector(NSApplication.hide(_:)), "h"),
            item("Verberg andere", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Toon alles", #selector(NSApplication.unhideAllApplications(_:))),
            .separator(),
            item("Stop \(name)", #selector(NSApplication.terminate(_:)), "q"),
        ])

        _ = menu("Archief", [
            item("Open Studio", #selector(showStudio(_:)), "n", mine: true),
            item("Sluit venster", #selector(NSWindow.performClose(_:)), "w"),
        ])

        _ = menu("Wijzig", [
            item("Herstel", Selector(("undo:")), "z"),
            item("Opnieuw", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            item("Knip", #selector(NSText.cut(_:)), "x"),
            item("Kopieer", #selector(NSText.copy(_:)), "c"),
            item("Plak", #selector(smartPaste(_:)), "v", mine: true),
            item("Selecteer alles", #selector(NSText.selectAll(_:)), "a"),
        ])

        _ = menu("Weergave", [
            item("Laad opnieuw", #selector(reload(_:)), "r", mine: true),
            .separator(),
            item("Terug", #selector(goBack(_:)), "[", mine: true),
            item("Vooruit", #selector(goForward(_:)), "]", mine: true),
            .separator(),
            item("Ware grootte", #selector(zoomReset(_:)), "0", mine: true),
            item("Zoom in", #selector(zoomIn(_:)), "+", mine: true),
            item("Zoom uit", #selector(zoomOut(_:)), "-", mine: true),
            .separator(),
            item("Schermvullende weergave", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ])

        _ = menu("Ga", sections.enumerated().map { index, section in
            let entry = item(section.title, #selector(goToSection(_:)), "\(index + 1)", mine: true)
            entry.representedObject = section.path
            return entry
        })

        NSApp.windowsMenu = menu("Venster", [
            item("Minimaliseer", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoom", #selector(NSWindow.performZoom(_:))),
            .separator(),
            item("Alles op voorgrond", #selector(NSApplication.arrangeInFront(_:))),
        ])

        NSApp.mainMenu = main
    }

    // ---- Test mode: `--snapshot <file.png>` loads the Studio, saves a picture of the page, quits

    private func startSnapshotIfAsked() {
        let arguments = CommandLine.arguments
        guard let flag = arguments.firstIndex(of: "--snapshot"), flag + 1 < arguments.count else { return }
        let file = URL(fileURLWithPath: arguments[flag + 1])
        var taken = false
        studio.onLoaded = { [weak self] in
            guard let self, !taken else { return }
            taken = true
            // Give the page's entrance animation time to finish.
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self.studio.webView.takeSnapshot(with: nil) { image, error in
                    guard let tiff = image?.tiffRepresentation,
                          let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]),
                          (try? png.write(to: file)) != nil
                    else {
                        FileHandle.standardError.write("snapshot failed: \(error?.localizedDescription ?? "no image")\n".data(using: .utf8)!)
                        exit(1)
                    }
                    print("page: \(self.studio.webView.url?.absoluteString ?? "-")")
                    print("title: \(self.studio.window.title)")
                    print("saved: \(file.path)")
                    let probe = "getComputedStyle(document.documentElement).overscrollBehaviorY + ' / ' + getComputedStyle(document.body).overscrollBehaviorY + '  window ' + innerWidth + 'x' + innerHeight + '  page height ' + document.documentElement.scrollHeight"
                    self.studio.webView.evaluateJavaScript(probe) { value, _ in
                        print("overscroll (html / body): \(value as? String ?? "?")")
                        // `--probe <file.js>`: also runs that script in the page and prints what it returns.
                        guard let flag = arguments.firstIndex(of: "--probe"), flag + 1 < arguments.count,
                              let script = try? String(contentsOfFile: arguments[flag + 1], encoding: .utf8)
                        else { exit(0) }
                        self.studio.webView.evaluateJavaScript(script) { value, error in
                            print("probe: \(value.map { "\($0)" } ?? "failed: \(error?.localizedDescription ?? "nothing returned")")")
                            exit(0)
                        }
                    }
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 40) {
            FileHandle.standardError.write("snapshot failed: the page did not load in 40 s\n".data(using: .utf8)!)
            exit(1)
        }
    }
}
