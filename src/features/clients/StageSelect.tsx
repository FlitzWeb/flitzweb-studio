"use client";

import { useTransition } from "react";
import { setStage } from "./actions";
import { STAGES, stageLabels, type Stage } from "./stages";
import styles from "./clients.module.css";

/** Dropdown that moves a lead or client to another stage right away. */
export function StageSelect({ id, stage }: { id: number; stage: Stage }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className={`input ${styles.stageSelect}`}
      aria-label="Fase"
      value={stage}
      disabled={pending}
      data-stage={stage}
      onChange={(e) => {
        const next = e.target.value as Stage;
        startTransition(() => setStage(id, next));
      }}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {stageLabels[s]}
        </option>
      ))}
    </select>
  );
}
