import type { MetadataRoute } from "next";

/**
 * Makes the Studio a proper home screen app. `scope: "/"` matters on iPhone:
 * without a manifest iOS guesses the app's scope from the page it was added
 * from, and every link outside that (Overzicht on "/") opened in Safari.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlitzWeb Studio",
    short_name: "Studio",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#060913",
    theme_color: "#060913",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
