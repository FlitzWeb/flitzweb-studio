import AppKit
import AVFoundation

/// The opening shown once each time the app starts: the Bolt Z sting (`intro.mp4`, the first 2.9 s
/// of the film in flitzweb-motion/bolt-z, with its sound) over the whole window while the Studio
/// loads behind it. A click skips it. How it hands over to the page is the `Transition`.
final class Intro: NSView {
    /// How the opening leaves. Chosen in the app menu (Overgang).
    enum Transition: String, CaseIterable {
        /// The Z grows until the window is one blue field, which then wipes off along the Z's slant.
        case flood
        /// The logo shrinks and flies to the Studio's own logo in the top bar while the wall goes.
        case logo
        /// A plain fade.
        case fade

        var title: String {
            switch self {
            case .flood: return "Z-vloed"
            case .logo: return "Logo naar de balk"
            case .fade: return "Vervagen"
            }
        }

        static var chosen: Transition {
            get { Transition(rawValue: UserDefaults.standard.string(forKey: "introTransition") ?? "") ?? .logo }
            set { UserDefaults.standard.set(newValue.rawValue, forKey: "introTransition") }
        }
    }

    /// "Geluid bij openen" in the app menu.
    static var soundOn: Bool {
        get { UserDefaults.standard.object(forKey: "introSound") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "introSound") }
    }

    /// False while the page behind is still loading: the opening then waits (on its last frame, or
    /// on the blue field) so it never hands over to an empty window.
    var pageReady = false { didSet { handOverIfDue() } }

    /// Where the page's own wordmark is, in this view's coordinates: its top left corner and width.
    typealias LogoSpot = (topLeft: CGPoint, width: CGFloat)
    /// Asks the window for that spot (nil: this page shows no logo).
    var findPageLogo: (@escaping (LogoSpot?) -> Void) -> Void = { $0(nil) }
    /// Hides the page's own logo while ours flies to it, and shows it again on landing.
    var setPageLogoHidden: (Bool) -> Void = { _ in }

    // ---- The film (numbers measured in intro.mp4; see the README when the film is cut again)

    private static let filmSize = CGSize(width: 1920, height: 1080)
    /// How long the picture runs. The sound rings on a little after that (a fading tail).
    private static let pictureLength: TimeInterval = 2.92
    /// When the Z starts to grow in the flood transition.
    private static let floodStart: TimeInterval = 2.5
    /// The Z in the film at `floodStart`: its centre and width, in film pixels, and its lit colour.
    private static let filmZCentre = CGPoint(x: 874, y: 549.5)
    private static let filmZWidth: CGFloat = 158
    private static let filmZColour = NSColor(srgbRed: 76 / 255.0, green: 136 / 255.0, blue: 1, alpha: 1)
    /// The whole wordmark in the film's last frame, in film pixels.
    private static let filmLogo = CGRect(x: 455, y: 433, width: 1005, height: 202)

    /// The Bolt Z, in the brand kit's 256 box (its centre is 128, 128; the middle of the slanted
    /// stroke, so scaling it up from there ends as a full field).
    private static let boltZ: [CGPoint] = [
        CGPoint(x: 46.66, y: 42), CGPoint(x: 55.89, y: 26), CGPoint(x: 220.89, y: 26), CGPoint(x: 136.6, y: 172),
        CGPoint(x: 209.34, y: 214), CGPoint(x: 200.11, y: 230), CGPoint(x: 35.11, y: 230), CGPoint(x: 119.4, y: 84),
    ]
    private static let boltZWidth: CGFloat = 220.89 - 35.11
    /// The widest circle around the centre that still fits inside the Z's slanted stroke.
    private static let boltZInnerRadius: CGFloat = 29.4
    /// How far the wipe's edge leans: sideways per unit of height, the slant of the Z's stroke.
    private static let slant: CGFloat = 84.29 / 146

    private static let voltage = NSColor(srgbRed: 0x2F / 255.0, green: 0x5B / 255.0, blue: 1, alpha: 1)
    private static let bolt = NSColor(srgbRed: 0x7C / 255.0, green: 0x9B / 255.0, blue: 1, alpha: 1)
    private static let night = NSColor(srgbRed: 0x03 / 255.0, green: 0x05 / 255.0, blue: 0x0f / 255.0, alpha: 1)

    /// The longest the opening waits for a slow page.
    private static let patience: TimeInterval = 4
    /// The film's sound is mixed as loud as a video (-14 LUFS). An app that opens many times a day
    /// plays it softer: 1 is the film's own level.
    private static let loudness: Float = 0.5

    // ---- State

    private let transition: Transition
    private let player: AVPlayer
    /// Behind the stage: the second colour of the wipe.
    private let under = CALayer()
    /// The film and, in the flood, the growing Z.
    private let stage = CALayer()
    private let video = AVPlayerLayer()
    /// The film's wall without the logo (`wall.mp4`, a still), waiting right under the film. In
    /// the logo flight the film is switched off, so the wall is all that is left and can leave
    /// slowly, without the film's own logo staying behind as a ghost. It is a film file, not a
    /// picture, so that it goes through the same colour handling as the film and matches it exactly.
    private var wallPlayer: AVPlayer?
    private let wall = AVPlayerLayer()
    private let zLayer = CAShapeLayer()
    private let flyer = CALayer()
    private var observers: [Any] = []
    private var endObserver: NSObjectProtocol?
    private var filmReady: NSKeyValueObservation?

    private var pictureOver = false
    private var flooded = false
    private var handingOver = false
    private var gone = false
    /// Test aid: `defaults write nl.flitzweb.studio.mac introSlow 8` stretches the hand-over
    /// (and mutes it), so each stage can be looked at. Delete the key to go back.
    private let slow: Double

    init?(file: URL?, transition: Transition = .chosen) {
        guard let file, FileManager.default.fileExists(atPath: file.path) else { return nil }
        self.transition = transition
        let stretch = UserDefaults.standard.double(forKey: "introSlow")
        slow = stretch > 0 ? stretch : 1
        player = AVPlayer(url: file)
        super.init(frame: .zero)
        player.isMuted = !Self.soundOn || slow != 1
        player.volume = Self.loudness
        player.actionAtItemEnd = .pause
        player.allowsExternalPlayback = false

        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        under.backgroundColor = Self.bolt.cgColor
        under.isHidden = true
        stage.backgroundColor = Self.night.cgColor
        video.player = player
        video.videoGravity = .resizeAspectFill
        zLayer.isHidden = true
        flyer.isHidden = true
        flyer.contentsGravity = .resize
        if let image = Bundle.main.image(forResource: "logo") {
            flyer.contents = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
            logoShape = image.size.height > 0 ? image.size.width / image.size.height : 5
        }
        if transition == .logo, let plate = Bundle.main.url(forResource: "wall", withExtension: "mp4") {
            let still = AVPlayer(url: plate)
            still.isMuted = true
            still.actionAtItemEnd = .pause
            wallPlayer = still
            wall.player = still
            // Kept out of sight until the film itself is on screen: the still is ready a moment
            // sooner, and would otherwise flash its lit wall before the film's dark first frames.
            wall.isHidden = true
            filmReady = video.observe(\.isReadyForDisplay, options: [.initial, .new]) { [weak self] layer, _ in
                guard layer.isReadyForDisplay else { return }
                DispatchQueue.main.async {
                    CATransaction.begin()
                    CATransaction.setDisableActions(true)
                    self?.wall.isHidden = false
                    CATransaction.commit()
                }
            }
            stage.addSublayer(wall)
        }
        stage.addSublayer(video)
        stage.addSublayer(zLayer)
        layer?.addSublayer(under)
        layer?.addSublayer(stage)
        layer?.addSublayer(flyer)

        func at(_ seconds: TimeInterval, _ action: @escaping () -> Void) {
            let time = CMTime(seconds: seconds, preferredTimescale: 600)
            observers.append(player.addBoundaryTimeObserver(forTimes: [NSValue(time: time)], queue: .main, using: action))
        }
        if transition == .flood { at(Self.floodStart) { [weak self] in self?.flood() } }
        at(Self.pictureLength) { [weak self] in self?.pictureEnded() }
        // The same, for a file that is shorter than expected.
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: player.currentItem, queue: .main
        ) { [weak self] _ in
            self?.pictureEnded()
        }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    deinit {
        observers.forEach { player.removeTimeObserver($0) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    }

    /// Width over height of logo.png (the flat wordmark that flies to the top bar).
    private var logoShape: CGFloat = 5

    func play() {
        // Test aid: `defaults write nl.flitzweb.studio.mac introFrom 2.3` starts the film there.
        let from = UserDefaults.standard.double(forKey: "introFrom")
        if from > 0 {
            player.seek(to: CMTime(seconds: from, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        }
        player.play()
        trace("play (\(transition.rawValue))")
        // A page that never loads must not keep the opening up for ever.
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.pictureLength + Self.patience) { [weak self] in
            self?.pageReady = true
        }
    }

    /// Test aid: with `introSlow` set, each stage is noted in /tmp/studio-intro-trace.log.
    private func trace(_ what: String) {
        guard slow != 1 else { return }
        let line = String(format: "%.3f  %@  slow=%.1f film=%.2f bounds=%@\n", CACurrentMediaTime(), what, slow,
                          player.currentTime().seconds, NSStringFromRect(bounds))
        let file = URL(fileURLWithPath: "/tmp/studio-intro-trace.log")
        if let handle = try? FileHandle(forWritingTo: file) {
            handle.seekToEndOfFile(); handle.write(line.data(using: .utf8)!); try? handle.close()
        } else {
            try? line.data(using: .utf8)!.write(to: file)
        }
    }

    // ---- Layout: the film fills the window, and film pixels are placed from that

    override func layout() {
        super.layout()
        guard !handingOver else { return }      // a resize mid hand-over keeps what is already moving
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        under.frame = bounds
        stage.frame = bounds
        video.frame = bounds
        wall.frame = bounds
        wall.videoGravity = fills ? .resizeAspectFill : .resizeAspect
        // The film is 16:9 with the logo across its middle half. A wide window crops its edges;
        // a tall, narrow one would cut into the logo, so there the whole frame is shown instead.
        video.videoGravity = fills ? .resizeAspectFill : .resizeAspect
        CATransaction.commit()
    }

    private var fills: Bool { bounds.width >= bounds.height }

    /// Window points per film pixel.
    private var filmScale: CGFloat {
        let across = bounds.width / Self.filmSize.width, down = bounds.height / Self.filmSize.height
        return fills ? max(across, down) : min(across, down)
    }

    /// A film pixel (origin top left) as a point in this view (origin bottom left).
    private func place(_ point: CGPoint) -> CGPoint {
        let scale = filmScale
        let left = (bounds.width - Self.filmSize.width * scale) / 2
        let bottom = (bounds.height - Self.filmSize.height * scale) / 2
        return CGPoint(x: left + point.x * scale, y: bottom + (Self.filmSize.height - point.y) * scale)
    }

    // ---- The hand-over

    override func mouseDown(with event: NSEvent) { fadeAway(over: 0.25) }

    private func pictureEnded() {
        guard !pictureOver else { return }
        pictureOver = true
        handOverIfDue()
    }

    private func handOverIfDue() {
        guard pageReady, !handingOver, !gone else { return }
        switch transition {
        case .flood: if flooded { wipe() }
        case .logo: if pictureOver { fly() }
        case .fade: if pictureOver { fadeAway(over: 0.45) }
        }
    }

    /// Runs `changes` (model values and animations) as one group, then `after`.
    private func animate(_ changes: () -> Void, then after: @escaping () -> Void) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock(after)
        changes()
        CATransaction.commit()
    }

    private func move(_ layer: CALayer, _ key: String, from: Any?, to: Any?, over duration: TimeInterval,
                      curve: CAMediaTimingFunction, delay: TimeInterval = 0) {
        let animation = CABasicAnimation(keyPath: key)
        animation.fromValue = from
        animation.toValue = to
        animation.duration = duration * slow
        animation.beginTime = CACurrentMediaTime() + delay * slow
        animation.timingFunction = curve
        animation.fillMode = .backwards
        layer.add(animation, forKey: key)
        layer.setValue(to, forKeyPath: key)
    }

    // Flood, part 1: a flat Z sits down exactly on the film's Z and grows from the middle of its
    // slanted stroke, slowly and then all at once, until the window is one blue field.
    private func flood() {
        guard !flooded, !handingOver, !gone, zLayer.isHidden else { return }
        trace("flood starts")
        let centre = place(Self.filmZCentre)
        let unit = Self.filmZWidth * filmScale / Self.boltZWidth
        func z(scaledBy factor: CGFloat) -> CGPath {
            let path = CGMutablePath()
            for (index, point) in Self.boltZ.enumerated() {
                let spot = CGPoint(x: centre.x + (point.x - 128) * unit * factor, y: centre.y - (point.y - 128) * unit * factor)
                if index == 0 { path.move(to: spot) } else { path.addLine(to: spot) }
            }
            path.closeSubpath()
            return path
        }
        let reach = max(hypot(centre.x, centre.y), hypot(bounds.width - centre.x, centre.y),
                        hypot(centre.x, bounds.height - centre.y), hypot(bounds.width - centre.x, bounds.height - centre.y))
        let full = reach / (Self.boltZInnerRadius * unit) * 1.1
        let burst = CAMediaTimingFunction(controlPoints: 0.7, 0, 0.84, 0)

        animate({
            zLayer.frame = bounds
            zLayer.isHidden = false
            move(zLayer, "path", from: z(scaledBy: 1), to: z(scaledBy: full), over: 0.5, curve: burst)
            move(zLayer, "fillColor", from: Self.filmZColour.cgColor, to: Self.voltage.cgColor, over: 0.5, curve: burst)
        }, then: { [weak self] in
            guard let self else { return }
            self.trace("flood done")
            self.flooded = true
            self.handOverIfDue()
        })
    }

    // Flood, part 2: the blue field leaves along the Z's slant, with a lighter blue edge right
    // behind it, and the page is underneath.
    private func wipe() {
        handingOver = true
        trace("wipe starts")
        let lean = bounds.height * Self.slant
        let start = -lean - 20
        let travel = bounds.width + lean + 40
        func curtain() -> CAShapeLayer {
            let path = CGMutablePath()
            path.move(to: CGPoint(x: start + lean, y: bounds.height))
            path.addLine(to: CGPoint(x: bounds.width * 3, y: bounds.height))
            path.addLine(to: CGPoint(x: bounds.width * 3, y: 0))
            path.addLine(to: CGPoint(x: start, y: 0))
            path.closeSubpath()
            let mask = CAShapeLayer()
            mask.path = path
            return mask
        }
        let sweep = CAMediaTimingFunction(controlPoints: 0.76, 0, 0.24, 1)
        let front = curtain(), back = curtain()

        animate({
            stage.backgroundColor = Self.voltage.cgColor
            video.isHidden = true
            under.isHidden = false
            stage.mask = front
            under.mask = back
            move(front, "position.x", from: 0, to: travel, over: 0.6, curve: sweep)
            move(back, "position.x", from: 0, to: travel, over: 0.6, curve: sweep, delay: 0.09)
        }, then: { [weak self] in self?.finish() })
    }

    // Logo: a flat copy of the wordmark takes the film's place, shrinks and flies to the Studio's
    // own logo in the top bar, while the wall behind it opens up and goes.
    private func fly() {
        handingOver = true
        trace("flight asked")
        findPageLogo { [weak self] spot in
            guard let self, !self.gone else { return }
            guard let spot, self.flyer.contents != nil else { return self.fadeAway(over: 0.45, force: true) }
            let landing = spot.width / self.logoShape
            let target = CGRect(x: spot.topLeft.x, y: spot.topLeft.y - landing, width: spot.width, height: landing)
            let topLeft = self.place(Self.filmLogo.origin)
            let width = Self.filmLogo.width * self.filmScale
            let height = width / self.logoShape
            let middle = topLeft.y - Self.filmLogo.height * self.filmScale / 2
            let from = CGRect(x: topLeft.x, y: middle - height / 2, width: width, height: height)
            let glide = CAMediaTimingFunction(controlPoints: 0.65, 0, 0.3, 1)
            let ease = CAMediaTimingFunction(name: .easeOut)
            self.setPageLogoHidden(true)
            self.trace("flight starts from \(NSStringFromRect(from)) to \(NSStringFromRect(target))")

            self.animate({
                self.flyer.isHidden = false
                self.flyer.bounds = CGRect(origin: .zero, size: from.size)
                self.move(self.flyer, "bounds.size", from: NSValue(size: from.size), to: NSValue(size: target.size),
                          over: 0.8, curve: glide)
                self.move(self.flyer, "position", from: NSValue(point: CGPoint(x: from.midX, y: from.midY)),
                          to: NSValue(point: CGPoint(x: target.midX, y: target.midY)), over: 0.8, curve: glide)
                self.trace("clean wall ready: \(self.wallPlayer != nil && self.wall.isReadyForDisplay)")
                if self.wallPlayer != nil, self.wall.isReadyForDisplay {
                    // The film gives way to its own wall without the logo, and that leaves slowly
                    // while the logo flies: it thins out and drifts a little towards the viewer.
                    self.video.isHidden = true
                    let drift = CAMediaTimingFunction(controlPoints: 0.4, 0, 0.2, 1)
                    self.move(self.stage, "opacity", from: 1, to: 0, over: 0.8, curve: drift)
                    self.move(self.stage, "transform.scale", from: 1, to: 1.06, over: 0.8, curve: drift)
                } else {
                    // No clean wall to show: the film goes quickly, while the logo has hardly
                    // moved yet. Its own logo is part of it, and a slow fade would leave that
                    // behind as a ghost of ours.
                    self.move(self.stage, "opacity", from: 1, to: 0, over: 0.22, curve: ease)
                }
            }, then: { [weak self] in
                guard let self else { return }
                // Landed: the page's own logo is right underneath; ours lets go.
                self.setPageLogoHidden(false)
                self.animate({
                    self.move(self.flyer, "opacity", from: 1, to: 0, over: 0.2, curve: ease)
                }, then: { [weak self] in self?.finish() })
            })
        }
    }

    /// The plain way out: also what a click does, and what the logo flight falls back to on a page
    /// without a logo.
    private func fadeAway(over duration: TimeInterval, force: Bool = false) {
        guard !gone, force || !handingOver else { return }
        handingOver = true
        // Skipped halfway: the sound fades out with the picture instead of stopping dead.
        let steps = 9
        let from = player.volume
        for step in 1...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + duration * Double(step) / Double(steps)) { [weak self] in
                self?.player.volume = from * Float(steps - step) / Float(steps)
            }
        }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = duration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            animator().alphaValue = 0
        }, completionHandler: { [weak self] in self?.finish() })
    }

    private func finish() {
        guard !gone else { return }
        gone = true
        trace("finished")
        setPageLogoHidden(false)
        // The sound's last tail may still be fading: let it end, then let go of the player.
        let player = self.player
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { player.pause() }
        removeFromSuperview()
    }
}
