"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { hashSecret, randomId } from "@/lib/access/crypto";
import { ADMIN_COOKIE, readAdmin } from "@/lib/access/session";
import {
  getAccessSettings,
  StorageNotConfiguredError,
  updateAccessSettings,
  type AccessSettings,
} from "@/lib/access/settings-store";

export type FormState = { ok?: string; error?: string };

const MIN_PASSWORD_LENGTH = 8;

// Server actions are reachable by POST regardless of proxy.ts, so each one checks the admin itself.
async function isAdmin(): Promise<boolean> {
  const settings = await getAccessSettings({ fresh: true });
  return readAdmin(settings, (await cookies()).get(ADMIN_COOKIE)?.value);
}

async function saveSecret(field: "sitePassword" | "viewCode", value: string, done: string): Promise<FormState> {
  const stored = { hash: await hashSecret(value), version: randomId(), updatedAt: Date.now() };
  try {
    await updateAccessSettings((settings): AccessSettings => ({ ...settings, [field]: stored }));
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return { error: error.message };
    console.error("Saving access settings failed:", error);
    return { error: "Saving failed. Please try again." };
  }
  refresh();
  return { ok: done };
}

export async function setSitePassword(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Your admin session has ended. Reload the page and sign in again." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "The two passwords don't match." };

  return saveSecret("sitePassword", password, "Password changed. Everyone has been signed out.");
}

export async function setViewCode(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Your admin session has ended. Reload the page and sign in again." };

  const code = String(formData.get("code") ?? "");
  if (!/^\d{6}$/.test(code)) return { error: "The code must be exactly 6 digits." };

  return saveSecret("viewCode", code, "View code changed. View mode is now off for everyone.");
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}
