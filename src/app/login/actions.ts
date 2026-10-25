"use server";

import { redirect } from "next/navigation";
import { logout, sendMagicLink } from "@/lib/auth";

export async function requestLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  // Same response whether or not the address is allowed, so the login page
  // doesn't reveal which email has access.
  await sendMagicLink(email);
  redirect("/login?sent=1");
}

export async function signOut() {
  await logout();
  redirect("/login");
}
