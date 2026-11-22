import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)     // a normal app: Dock icon, ⌘Tab, its own menus
app.run()
