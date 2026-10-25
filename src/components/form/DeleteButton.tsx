"use client";

import { useTransition } from "react";

/** Asks for confirmation, then runs a server action (e.g. deleteSite.bind(null, id)). */
export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => action());
      }}
    >
      {pending ? "Bezig…" : label}
    </button>
  );
}
