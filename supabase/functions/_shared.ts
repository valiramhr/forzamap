// shared helpers for edge functions (Deno runtime)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** SITE_URL without a trailing slash, so paths can be appended blind. */
export function siteUrl() {
  return Deno.env.get("SITE_URL")!.replace(/\/+$/, "");
}

/* An invite token: 32 random bytes, hex. Unguessable, and durable — it is the
   one thing a candidate is given, so it must survive a re-invite. */
export function newInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const shell = (body: string) =>
  `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#1A1D24">${body}</div>`;

const button = (href: string, label: string) => `
  <p style="margin:28px 0">
    <a href="${href}" style="background:#1A1D24;color:#FBFAF7;
       padding:14px 22px;text-decoration:none;font-family:monospace;
       letter-spacing:.05em;text-transform:uppercase;font-size:13px">
       ${label}</a>
  </p>`;

async function sendMail(to: string, subject: string, html: string) {
  const from = Deno.env.get("INVITE_FROM") ?? "Strengths Profile <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error("Resend failed: " + (await res.text()));
}

/* The invitation.

   The link carries an invite token, not a session. Mail scanners pre-fetch URLs
   in an incoming message, which is fatal to a single-use magic link — the
   scanner spends it and the recipient gets a dead link. /start/{token} can be
   fetched any number of times: it is the landing page that mints a magic link,
   in the real browser, and that one is used within milliseconds. */
export async function sendInviteLink(
  email: string,
  fullName: string | null | undefined,
  token: string,
) {
  const link = `${siteUrl()}/start/${token}`;
  await sendMail(email, "Your Strengths Profile link", shell(`
        <p style="font-size:18px">Hi${fullName ? " " + fullName : ""},</p>
        <p>You've been invited to complete a Strengths Profile. It takes about
           12 minutes. Use the button below to begin — the link signs you in
           directly, so there's no password.</p>
        ${button(link, "Open my assessment")}
        <p style="font-size:13px;color:#6B7280">This link does not expire, and
           you can use it as often as you like — if you are interrupted, open it
           again and you'll pick up where you left off. Keep this email. The link
           is personal to you, so please don't forward it.</p>`));
}

// mint a magic link for an existing user and email it through Resend. This is
// the sign-in page's fallback for someone who has lost their invitation — the
// link is single-use and short-lived, and the copy says so.
export async function sendMagicLink(email: string, fullName?: string | null) {
  const sb = admin();
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: siteUrl() },
  });
  if (error) throw error;
  const link = data.properties?.action_link;
  if (!link) throw new Error("no action_link returned");

  await sendMail(email, "Your Strengths Profile link", shell(`
        <p style="font-size:18px">Hi${fullName ? " " + fullName : ""},</p>
        <p>Here is the sign-in link you asked for. It signs you in directly, so
           there's no password.</p>
        ${button(link, "Sign in")}
        <p style="font-size:13px;color:#6B7280">This link is single-use and
           expires shortly. If it stops working, request a new one from the
           sign-in page.</p>`));
}
