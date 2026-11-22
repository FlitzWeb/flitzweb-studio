# FlitzWeb Studio for Mac

The Studio as a Mac app: its own Dock icon, window, ⌘Tab and menus. Inside the window is the live
Studio (`https://studio.flitzweb.nl`), so a deploy shows up in the app without a new build.

- **Opening.** Each time the app starts, the Bolt Z sting plays over the whole window (2.9 s, with
  its sound) while the Studio loads behind it, then hands over to the page. Click to skip it. It
  does not play when "Reduce motion" is on in System Settings. In the **FlitzWeb Studio** menu:
  **Geluid bij openen** turns the sound off and on, **Speel opening af** (⇧⌘O) plays it again, and
  **Overgang** picks how it hands over:
  - **Logo naar de balk** (the default): the wordmark shrinks and flies to the Studio's own logo
    in the top bar, while the wall behind it thins out slowly.
  - **Z-vloed**: the Z grows until the window is one blue field, which wipes off along the Z's slant.
  - **Vervagen**: a plain fade.
- **Dock badge.** The Dock icon shows how many sites are offline (nothing when all are online),
  by the same rule as the "Alles online" pill. Right-click the icon for their names. It asks the
  Studio (`/api/status`) after every page load and then just after each uptime check is due, so it
  costs no database time of its own; a site that goes down shows up within about half an hour.
- **Framed.** The page sits in a rounded card with a hairline edge and a little of the window
  around it, and its scrollbar is a thin thumb in the page's own tone.
- **No stretchy scrolling.** A page stops at its top and bottom instead of pulling past them and
  springing back.
- **Menus and shortcuts.** ⌘1–⌘4 jump to Overzicht, Leads, Klanten and Geld. ⌘R reloads, ⌘[ / ⌘] go
  back and forward, ⌘+ / ⌘- / ⌘0 zoom (remembered), ⌃⌘F is full screen. ⌘K is the Studio's own search.
- **Closing the window** keeps the app in the Dock. Click the Dock icon (or ⌘N) to bring it back.
- **Links to other sites** (a client's site, GitHub, a payment page) open in your browser.
- **The month report's picture** (any Studio link that asks for a new tab) opens in a window of
  its own. Close it with the red button, ⌘W or Esc and the Studio is where you left it.
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

## Opening film

`intro.mp4` is the first 73 frames (2.92 s, up to just before "flitzweb.nl" appears) of the Bolt Z
sting in `~/Documents/GitHub/flitzweb-motion/bolt-z`, with the sting's "CC0 sound" mix (every
recording in it is CC0). The sound runs to 3.37 s, fading out from 2.5 s, so the last hit rings
out under the fade into the page. To cut it again after a new render of the sting, from
`~/Documents/GitHub/flitzweb-motion/bolt-z/out`:

```bash
ffmpeg -y -framerate 25 -start_number 1 -i comp-1920x1080/%04d.png -i "FlitzWeb Bolt Z sting v2 - 1920x1080 - CC0 sound.mp4" -map 0:v -map 1:a -frames:v 73 -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -af "atrim=0:3.37,afade=t=out:st=2.5:d=0.87:curve=qsin" -c:a aac -b:a 160k -movflags +faststart intro.mp4
```

Then move `intro.mp4` into this folder. `Sources/Intro.swift` plays it: `pictureLength` there is
the length of the picture, and `loudness` (0.5) is how loud the sound plays next to the film's own
level, which is mixed for a video and too loud for an app. Delete `intro.mp4` and rebuild to have
no opening.

## How it works

- No Xcode project: `build.sh` compiles `Sources/*.swift` with `swiftc` and puts the bundle
  together by hand (ad-hoc signed, bundle id `nl.flitzweb.studio.mac`).
- `StudioWindow.swift` is one `WKWebView` in a window, plus what a browser does for a page:
  dialogs, file pickers, downloads, links to other sites.
- `AppDelegate.swift` builds the menus. The sections in the **Ga** menu are a copy of
  `src/app/(dashboard)/nav.ts`: change both when a section is added.
- The one thing in the Studio made for the app is `src/app/api/status/route.ts` (the Dock badge).
  The badge asks again `checkEvery` (30 minutes, in `StudioWindow.swift`) plus a minute after the
  newest check: change that number if the uptime check's schedule changes. It must stay tied to
  the check, never a short timer, because every call wakes the database.

## Testing

```bash
"build/FlitzWeb Studio.app/Contents/MacOS/Studio" --snapshot /tmp/studio.png
```

loads the Studio, saves a picture of the page and quits. `--open /leads` starts on that page,
`--no-intro` skips the opening.

To look at a hand-over stage by stage, slow it down (this also mutes it and writes each stage to
`/tmp/studio-intro-trace.log`) and start the film near its end, then replay from the menu:

```bash
defaults write nl.flitzweb.studio.mac introSlow -float 8
```

```bash
defaults write nl.flitzweb.studio.mac introFrom -float 2.35
```

`defaults delete nl.flitzweb.studio.mac introSlow` (and the same for `introFrom`) goes back.

`defaults write nl.flitzweb.studio.mac introTrace -bool true` writes how the film gets going to
the same log at normal speed: when it is loaded, started and shown, where it is every 50 ms, and
when the main thread was held up. The film is started on the Mac's clock and only shown once it
moves; with a plain `play()` its first frame sat still for about 0.3 s, until the sound hardware
was awake.

`--probe <file.js>` with `--snapshot` runs that script in the loaded page and prints what it
returns (used to measure the page's height at a window size).

`defaults write nl.flitzweb.studio.mac badgeTest -int 2` pretends two sites are offline (reload the
page with ⌘R to see the badge); delete the key to go back.

The numbers at the top of `Sources/Intro.swift` (where the Z and the wordmark sit in the film) were
measured in `intro.mp4`; measure them again if the film is cut from a different render. `logo.png`
is the kit's `flitzweb-logo-reversed-2400.png`, trimmed to the letters and scaled to 1600 px.

`wall.mp4` is the film's last frame with the logo taken out (the area around it filled in smoothly
from the wall next to it), as a five-frame still. In the logo flight the film is switched off at
the moment the flat logo takes over, so this wall is what is left and can leave slowly; with the
film itself, its own 3D logo would stay behind as a ghost. It is a film file, not a picture, so
that its colours go through the same handling as the film's and match exactly. Make it again from
the new last frame if the film is cut from a different render.
`STUDIO_URL=http://localhost:3210` in front points the app at a local copy.
