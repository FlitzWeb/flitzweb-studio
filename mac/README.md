# FlitzWeb Studio for Mac

The Studio as a Mac app: its own Dock icon, window, ⌘Tab and menus. Inside the window is the live
Studio (`https://studio.flitzweb.nl`), so a deploy shows up in the app without a new build.

- **Menus and shortcuts.** ⌘1–⌘4 jump to Overzicht, Leads, Klanten and Geld. ⌘R reloads, ⌘[ / ⌘] go
  back and forward, ⌘+ / ⌘- / ⌘0 zoom (remembered), ⌃⌘F is full screen. ⌘K is the Studio's own search.
- **Closing the window** keeps the app in the Dock. Click the Dock icon (or ⌘N) to bring it back.
- **Links to other sites** (a client's site, GitHub, a payment page) open in your browser.
- **Downloads** (the report image) land in Downloads and are shown in Finder.
- **Light and dark.** The title bar takes the page's background colour, so it follows the theme.

## Build and install

Needs Xcode (or its command line tools) and macOS 13 or newer.

```bash
./build.sh install
```

That builds `build/FlitzWeb Studio.app`, copies it to `/Applications` and opens it. `./build.sh`
alone only builds.

## Signing in

The app keeps its own sign-in, separate from Safari and Chrome, for 30 days at a time.

1. Type your email address in the app and press **Stuur inloglink**.
2. In the mail, **copy** the link (right-click → Copy Link). Clicking it would open the browser and
   sign that in instead.
3. Back in the app, press **⌘V** and then **Inloggen**.

⌘V only looks at the clipboard for a login link while the login page is on screen. Anywhere else
it is a normal paste.

## Icon

`icon.svg` is the drawing (the Bolt Z on Voltage blue, in the macOS shape). After changing it:

```bash
./make-icon.sh
```

```bash
./build.sh install
```

`make-icon.sh` needs resvg (`brew install resvg`).

## How it works

- No Xcode project: `build.sh` compiles `Sources/*.swift` with `swiftc` and puts the bundle
  together by hand (ad-hoc signed, bundle id `nl.flitzweb.studio.mac`).
- `StudioWindow.swift` is one `WKWebView` in a window, plus what a browser does for a page:
  dialogs, file pickers, downloads, links to other sites.
- `AppDelegate.swift` builds the menus. The sections in the **Ga** menu are a copy of
  `src/app/(dashboard)/nav.ts`: change both when a section is added.
- Nothing in the Studio itself knows about the app. There is no Dock badge yet: that needs a small
  status endpoint in the Studio first.

## Testing

```bash
"build/FlitzWeb Studio.app/Contents/MacOS/Studio" --snapshot /tmp/studio.png
```

loads the Studio, saves a picture of the page and quits. `--open /leads` starts on that page.
`STUDIO_URL=http://localhost:3210` in front points the app at a local copy.
