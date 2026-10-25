import { LayoutGrid, Users, Wallet, type LucideIcon } from "lucide-react";

// Main navigation. Add an entry here when a new section gets its own page.
export const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overzicht", icon: LayoutGrid },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/geld", label: "Geld", icon: Wallet },
];

/** The overview also owns the site pages. */
export const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" || pathname.startsWith("/sites") : pathname.startsWith(href);
