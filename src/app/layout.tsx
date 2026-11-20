import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: { default: "FlitzWeb Studio", template: "%s · FlitzWeb Studio" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#060913",
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("fw-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

// Hides the page content until the enter animation takes over (so the finished page
// doesn't flash first). Skipped with reduced motion; never longer than 1.5 s.
const motionScript = `if(!matchMedia("(prefers-reduced-motion: reduce)").matches){var h=document.documentElement;h.classList.add("motion-pending");setTimeout(function(){h.classList.remove("motion-pending")},1500)}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nl"
      className={figtree.variable}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Script id="motion" strategy="beforeInteractive">
          {motionScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
