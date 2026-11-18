"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { logout, logoutEverywhere, requireSession, sendMagicLink } from "@/lib/auth";

export async function requestLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  // Same response, at the same speed, whether or not the address is allowed: the link is
  // made and emailed after the response has gone, so its timing reveals nothing.
  after(() => sendMagicLink(email).catch((error) => console.error("magic link:", error)));
  redirect("/login?sent=1");
}

export async function signOut() {
  await logout();
  redirect("/login");
}

/** Logs out on every device, this one included. */
export async function signOutEverywhere() {
  await requireSession();
  await logoutEverywhere();
  redirect("/login");
}
