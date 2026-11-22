import Foundation

/// Where the Studio lives. `STUDIO_URL=http://localhost:3210 open -a "FlitzWeb Studio"` (or running the
/// binary with that variable) points the app at a local copy instead.
enum Server {
    static let url: URL = {
        if let raw = ProcessInfo.processInfo.environment["STUDIO_URL"],
           let url = URL(string: raw), url.host != nil {
            return url
        }
        return URL(string: "https://studio.flitzweb.nl")!
    }()

    /// True for the Studio's own pages (same scheme, host and port), false for every other site.
    static func owns(_ url: URL) -> Bool {
        url.scheme?.lowercased() == Self.url.scheme?.lowercased()
            && url.host?.lowercased() == Self.url.host?.lowercased()
            && url.port == Self.url.port
    }

    static func page(_ path: String) -> URL {
        URL(string: path, relativeTo: url)?.absoluteURL ?? url
    }

    /// The login link from the email, found anywhere in a copied text (the link alone, or the whole
    /// mail). Only a link to this Studio's own /auth/verify counts.
    static func loginLink(in text: String) -> URL? {
        var origin = "\(url.scheme ?? "https")://\(url.host ?? "")"
        if let port = url.port { origin += ":\(port)" }
        let pattern = NSRegularExpression.escapedPattern(for: origin) + "/auth/verify\\?token=[A-Za-z0-9_-]+"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range, in: text),
              let link = URL(string: String(text[range])), owns(link)
        else { return nil }
        return link
    }
}
