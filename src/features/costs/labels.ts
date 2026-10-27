import type { Cost } from "@/db";

export const categoryLabels: Record<Cost["category"], string> = {
  software: "Software",
  ai: "AI",
  domain: "Domein",
  hosting: "Hosting",
  hardware: "Hardware",
  other: "Overig",
};

export const intervalLabels: Record<Cost["interval"], string> = {
  monthly: "Per maand",
  yearly: "Per jaar",
  once: "Eenmalig",
};

/** Suffix after an amount: "/mnd", "/jaar" or nothing. */
export const intervalSuffix: Record<Cost["interval"], string> = {
  monthly: " /mnd",
  yearly: " /jaar",
  once: "",
};
