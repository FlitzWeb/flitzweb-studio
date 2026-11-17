import type { Client } from "@/db";
import { FollowUpControl } from "./FollowUpControl";
import { StageSelect } from "./StageSelect";
import styles from "./clients.module.css";
import tabStyles from "@/features/site-tabs/tabs.module.css";

/** Stage + next follow-up for one lead or client. */
export function PipelineCard({ client, today }: { client: Client; today: string }) {
  return (
    <section className={tabStyles.panel}>
      <h2 className={tabStyles.h2}>Pijplijn</h2>
      <div className={styles.pipeline}>
        <div>
          <span className="label">Fase</span>
          <StageSelect id={client.id} stage={client.stage} />
        </div>
        <div>
          <span className="label">{client.stage === "client" ? "Weer contact opnemen" : "Opvolgen op"}</span>
          <FollowUpControl id={client.id} date={client.nextFollowUp} today={today} />
        </div>
      </div>
      {(client.industry || client.websiteStatus) && (
        <dl className={tabStyles.facts}>
          {client.industry && (
            <div>
              <dt>Branche</dt>
              <dd>{client.industry}</dd>
            </div>
          )}
          {client.websiteStatus && (
            <div>
              <dt>Website nu</dt>
              <dd>{client.websiteStatus}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
