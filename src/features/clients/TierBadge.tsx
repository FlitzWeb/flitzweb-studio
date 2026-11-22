import { isTier, tierTone } from "./stages";
import styles from "./clients.module.css";

/** The lead's tier (A, B or C) with its score. Renders nothing for a lead without research. */
export function TierBadge({ tier, score }: { tier: string | null; score?: number | null }) {
  if (!isTier(tier)) return null;
  return (
    <span className={styles.tier} data-tone={tierTone[tier]} title={score != null ? `Tier ${tier}, score ${score} van 100` : `Tier ${tier}`}>
      {tier}
      {score != null && <small>{score}</small>}
    </span>
  );
}
