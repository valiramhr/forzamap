import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { failureBody, failureMessage } from "../lib/edge";
import { PAPER, INK, MUTED, BODY, FORZA } from "../lib/ui";

/* Where an invite link lands. Unguarded on purpose: whoever arrives here has no
   session yet, and the token in the URL is the credential.

   The token is durable, so a mail scanner pre-fetching this page costs nothing —
   it is the redemption below that mints a single-use magic link, and the real
   browser follows that within milliseconds. */

interface Failure { heading: string; detail: string }

const FAILURES: Record<string, Failure> = {
  completed: {
    heading: "This assessment has already been submitted.",
    detail: "There is nothing left to complete. If you think that's wrong, contact whoever invited you.",
  },
  not_found: {
    heading: "This link isn't recognised.",
    detail: "It may have been replaced by a newer one, or copied incompletely from the email — check that you have the whole address.",
  },
};

const GENERIC: Failure = {
  heading: "Could not open your assessment.",
  detail: "Something went wrong signing you in. Check your connection and try the link again.",
};

export default function StartInvite() {
  const { token } = useParams<{ token: string }>();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  // StrictMode mounts twice in development, and every redemption mints a link.
  // One per arrival.
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;
    (async () => {
      if (!token) { setFailure(FAILURES.not_found); return; }
      try {
        const { data, error } = await supabase.functions.invoke("redeem-invite", { body: { token } });
        const body = await failureBody(error, data);
        const url = body?.url;
        if (!error && url) {
          // replace(), not assign(): the token URL should not sit in history as
          // a back-button target once it has been spent.
          window.location.replace(url);
          return;
        }
        const known = body?.reason ? FAILURES[String(body.reason)] : undefined;
        setFailure(known ?? GENERIC);
        if (!known) setReason((await failureMessage(error, data)) ?? null);
      } catch (e: any) {
        setFailure(GENERIC);
        setReason(String(e?.message ?? e));
      }
    })();
  }, [token]);

  return (
    <div className="stwrap">
      <img src="/brand/forzamap-lockup-tagline.svg" alt="ForzaMap — your strengths, charted"
        className="stlockup" />

      {failure ? (
        <div role="alert">
          <h1 className="sth1">{failure.heading}</h1>
          <p className="stbody">{failure.detail}</p>
          {reason && <p className="streason">{reason}</p>}
          <p className="stbody">
            You can always get back in from the sign-in page: enter the email you
            were invited with and a fresh link is sent to you.
          </p>
          <Link to="/login" className="font-label stlink">Go to sign in</Link>
        </div>
      ) : (
        <p className="stwait" role="status">Signing you in…</p>
      )}

      <style>{`
        .font-label{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:500;letter-spacing:.07em}
        .stwrap{min-height:100vh;background:${PAPER};display:grid;align-content:center;
          justify-items:start;max-width:480px;margin:0 auto;padding:24px;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif}
        .stlockup{width:220px;margin-bottom:28px}
        .sth1{font-weight:800;letter-spacing:-0.035em;font-size:1.5rem;color:${INK};margin:0 0 12px}
        .stbody{color:${BODY};line-height:1.6;margin:0 0 16px}
        .streason{color:${FORZA};font-size:13px;line-height:1.55;margin:0 0 16px}
        .stwait{color:${MUTED};line-height:1.6;margin:0}
        .stlink{display:inline-block;margin-top:4px;padding:12px 22px;background:${INK};
          color:${PAPER};font-size:13px;letter-spacing:.07em;text-transform:uppercase;
          text-decoration:none}
        a:focus-visible{outline:2px solid ${INK};outline-offset:2px}
      `}</style>
    </div>
  );
}
