"use client";

import { useActionState } from "react";
import { Field } from "@/components/form/Field";
import { addContact } from "./actions";
import { contactKindLabels } from "./stages";
import styles from "./clients.module.css";

/** One line to log a contact moment and plan the next one. */
export function ContactLogForm({ clientId, today, preferred }: { clientId: number; today: string; preferred: string }) {
  const [state, action, pending] = useActionState(addContact.bind(null, clientId), {});
  const f = { state };

  return (
    // `key` remounts the form after every submit: cleared on success, refilled on an error.
    <form key={state.at} action={action} className={styles.logForm} noValidate>
      <Field
        {...f}
        as="select"
        name="kind"
        label="Soort"
        initial={preferred}
        options={Object.entries(contactKindLabels).map(([value, label]) => ({ value, label }))}
      />
      <Field {...f} name="occurredOn" label="Datum" type="date" initial={today} />
      <Field
        {...f}
        as="select"
        name="followUp"
        label="Opvolgen"
        initial=""
        options={[
          { value: "", label: "Niet wijzigen" },
          { value: "1", label: "Morgen" },
          { value: "3", label: "Over 3 dagen" },
          { value: "7", label: "Over 1 week" },
          { value: "14", label: "Over 2 weken" },
          { value: "30", label: "Over 1 maand" },
          { value: "none", label: "Geen opvolging" },
        ]}
      />
      <div className={styles.logBody}>
        <Field {...f} as="textarea" name="body" label="Wat is er gezegd?" placeholder="Leeg laten mag: dan staat er alleen dat je contact had." />
      </div>
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Vastleggen"}
        </button>
      </div>
    </form>
  );
}
