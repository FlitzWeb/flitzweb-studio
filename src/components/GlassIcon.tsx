"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { BOLT_MARK, BoltMark } from "./Logo";
import { startGlassIcon } from "./glassIconEngine";
import styles from "./GlassIcon.module.css";

/**
 * The app icon forming in glass: a droplet grows into the tile, bends the bolt into colour at its
 * rim, then settles into the flat icon. Plays once on mount; a still icon without WebGL2 or with
 * reduced motion. Decorative: the page names FlitzWeb elsewhere.
 */
export function GlassIcon({ size = 112, className }: { size?: number; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;
    const engine = startGlassIcon(stage, { path: BOLT_MARK.d, tile: size });
    if (!engine) {
      wrap.dataset.still = "";
      return;
    }
    return () => engine.dispose();
  }, [size]);

  return (
    <div
      ref={wrapRef}
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={{ "--tile": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <div ref={stageRef} className={styles.stage} />
      <div className={styles.still}>
        <BoltMark className={styles.stillBolt} />
      </div>
    </div>
  );
}
