"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

/** A panel: the shared .card, or any block with a border and big rounded corners. */
function isPanel(el: Element) {
  if (el.matches(".card, .page-head, [data-enter]")) return true;
  const cs = getComputedStyle(el);
  return parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) >= 12;
}

/** The blocks to stagger in: walk down from the stage until we hit panels. */
function collectPanels(root: Element, depth = 0, out: Element[] = []) {
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || child.offsetParent === null) continue;
    if (child.matches("style, script, [aria-hidden='true']")) continue;
    if (isPanel(child) || depth >= 3 || child.children.length === 0) out.push(child);
    else collectPanels(child, depth + 1, out);
  }
  return out;
}

/**
 * Whether React has hydrated this element. With loading.tsx the page streams in after the
 * layout, and React hydrates it a little later than PageMotion's own effect runs. Touching it
 * before then (inline styles, the counted-up "0") makes hydration fail, so we wait for it.
 */
const isHydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith("__reactFiber$"));

// "1.168", "€ 200,00", "72%": one Dutch-formatted number with text around it.
const NUMBER = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(\D*)$/;

/** Counts the number in an element's first text node up from 0, then restores the exact text. */
function countUp(tl: gsap.core.Timeline, el: HTMLElement, at: number, duration = 0.8) {
  const node = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.nodeValue?.trim());
  const original = node?.nodeValue;
  const match = original && NUMBER.exec(original.trim());
  if (!node || !original || !match) return;
  const [, before, whole, decimals = "", after] = match;
  const target = Number(whole.replaceAll(".", "") + (decimals ? `.${decimals}` : ""));
  if (!target) return;
  const fmt = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals.length,
    maximumFractionDigits: decimals.length,
    useGrouping: whole.includes(".") || target >= 10000,
  });
  const counter = { v: 0 };
  node.nodeValue = `${before}${fmt.format(0)}${after}`;
  tl.to(
    counter,
    {
      v: target,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        node.nodeValue = `${before}${fmt.format(counter.v)}${after}`;
      },
      // Hand the node back exactly as React rendered it.
      onComplete: () => {
        node.nodeValue = original;
      },
      onInterrupt: () => {
        node.nodeValue = original;
      },
    },
    at,
  );
}

/**
 * Motion for every page, after the 21st.dev glassy dashboard: the content
 * blurs in, panels rise in a stagger, headline numbers count up, bars grow
 * and gauges sweep. The first page gets the full entrance; later pages a short
 * one, so switching pages never waits on the animation. While a loading
 * skeleton is showing it waits and animates the real content when it arrives.
 * Runs once per page (not on the 60 s auto-refresh) and not at all with reduced
 * motion. Pages opt nothing in: it reads the DOM.
 */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const firstDone = useRef(false);
  const pathname = usePathname();

  useGSAP(
    (_, contextSafe) => {
      const html = document.documentElement;
      const layer = root.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!layer || reduced) {
        html.classList.remove("motion-pending");
        return;
      }
      let safety: number | undefined;
      let wait: number | undefined;

      const play = contextSafe!(() => {
        const quick = firstDone.current;
        firstDone.current = true;

        const panels = collectPanels(layer);
        const bars = Array.from(layer.querySelectorAll<HTMLElement>("span[style*='width'], i[style*='width']")).filter(
          (el) => el.style.width.endsWith("%"),
        );
        const ticks = layer.querySelectorAll("[data-tick]");
        const counts = layer.querySelectorAll<HTMLElement>("[data-count]");

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        if (!quick) {
          tl.fromTo(layer, { opacity: 0.4, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.35, clearProps: "opacity,filter" }, 0);
        }
        if (panels.length) {
          tl.fromTo(
            panels,
            { y: quick ? 8 : 18, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: quick ? 0.28 : 0.55,
              stagger: { each: quick ? 0.02 : 0.045, amount: Math.min(quick ? 0.12 : 0.5, panels.length * 0.045) },
              clearProps: "transform,opacity",
            },
            quick ? 0 : 0.04,
          );
        }
        // The page was hidden by CSS until now (no flash of the finished page).
        html.classList.remove("motion-pending");

        if (bars.length) {
          tl.from(bars, { scaleX: 0, transformOrigin: "left center", duration: quick ? 0.45 : 0.7, stagger: { each: 0.02, amount: quick ? 0.15 : 0.35 }, clearProps: "transform,transformOrigin" }, quick ? 0.05 : 0.18);
        }
        if (ticks.length) {
          tl.from(ticks, { opacity: 0, duration: 0.25, stagger: quick ? 0.008 : 0.018, ease: "none", clearProps: "opacity" }, quick ? 0.05 : 0.2);
        }
        counts.forEach((el, i) => countUp(tl, el, (quick ? 0 : 0.1) + i * 0.03, quick ? 0.5 : 0.8));

        // Safety net: without animation frames (background tab, hidden window) the
        // timeline would sit half-way with zeros showing. Timers still run, so jump to the end.
        safety = window.setTimeout(() => tl.progress(1), 2500);
      });

      // Play once everything we animate is hydrated. Timers, not frames: frames stall in a hidden tab.
      const whenHydrated = (tries = 0) => {
        const targets = [...collectPanels(layer), ...layer.querySelectorAll("[data-count]")];
        if (targets.every(isHydrated)) play();
        else if (tries < 150) wait = window.setTimeout(() => whenHydrated(tries + 1), 20);
        else html.classList.remove("motion-pending"); // give up on the animation, never on the page
      };

      // A loading skeleton (loading.tsx) is up: show it, and animate once the page replaces it.
      let observer: MutationObserver | undefined;
      if (layer.querySelector("[data-skeleton]")) {
        html.classList.remove("motion-pending");
        observer = new MutationObserver(() => {
          if (layer.querySelector("[data-skeleton]")) return;
          observer?.disconnect();
          whenHydrated();
        });
        observer.observe(layer, { childList: true, subtree: true });
      } else {
        whenHydrated();
      }

      return () => {
        observer?.disconnect();
        window.clearTimeout(wait);
        window.clearTimeout(safety);
      };
    },
    { scope: root, dependencies: [pathname], revertOnUpdate: true },
  );

  return (
    <div ref={root} data-motion-root>
      {children}
    </div>
  );
}
