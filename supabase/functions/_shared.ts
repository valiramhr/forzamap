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

// mint a magic link for an existing user and email it through Resend
export async function sendMagicLink(email: string, fullName?: string | null) {
  const sb = admin();
  const redirectTo = Deno.env.get("SITE_URL")!;
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error) throw error;
  const link = data.properties?.action_link;
  if (!link) throw new Error("no action_link returned");

  const from = Deno.env.get("INVITE_FROM") ?? "Strengths Profile <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Strengths Profile link",
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#1A1D24">
          <p style="font-size:18px">Hi${fullName ? " " + fullName : ""},</p>
          <p>You've been invited to complete a Strengths Profile. It takes about
             12 minutes. Use the button below to begin — the link signs you in
             directly, so there's no password.</p>
          <p style="margin:28px 0">
            <a href="${link}" style="background:#1A1D24;color:#FBFAF7;
               padding:14px 22px;text-decoration:none;font-family:monospace;
               letter-spacing:.05em;text-transform:uppercase;font-size:13px">
               Begin assessment</a>
          </p>
          <p style="font-size:13px;color:#6B7280">This link is single-use and
             expires shortly. If it stops working, request a new one from the
             sign-in page.</p>
        </div>`,
    }),
  });
  if (!res.ok) throw new Error("Resend failed: " + (await res.text()));
}
