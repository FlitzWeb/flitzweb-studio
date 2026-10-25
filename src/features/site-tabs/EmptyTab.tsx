import styles from "./tabs.module.css";

export function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.h2}>{title}</h2>
      <p className={styles.muted}>{body}</p>
    </section>
  );
}
