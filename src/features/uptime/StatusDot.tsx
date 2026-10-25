import styles from "./uptime.module.css";

export type Status = "up" | "down" | "unknown" | "off";

export const statusOf = (s: { monitored: boolean; isUp: boolean | null }): Status =>
  !s.monitored ? "off" : s.isUp === null ? "unknown" : s.isUp ? "up" : "down";

const label: Record<Status, string> = {
  up: "Online",
  down: "Offline",
  unknown: "Nog niet gecheckt",
  off: "Niet gemonitord",
};

export function StatusDot({ status, size = 14 }: { status: Status; size?: number }) {
  return (
    <span
      className={styles.dot}
      data-status={status}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label[status]}
    />
  );
}

export const statusLabel = (s: Status) => label[s];
