# Strengths Profile

An invite-only, forced-choice strengths assessment. Candidates sign in with a
magic link (no passwords, no self-signup), complete a timed 130-item instrument,
and get a ranked profile they can view online and download as a PDF. Admins send
invitations and view every candidate's report.

**Stack:** React + TypeScript + Vite · Supabase (Postgres + Auth + Edge Functions)
· Resend (email) · Vercel (hosting). See `docs/strengths-methodology.md` for the
instrument design.

---

## How the pieces fit

- **Auth is invitation-only.** Auth users are created *only* by the `admin-invite`
  edge function (service role). The public login page calls `request-link`, which
  re-sends a magic link *only* to addresses already in `candidates` or `admins`, and
  always returns success so unknown addresses can't be probed.
- **RLS** (in `supabase/migrations/0001_init.sql`) lets a candidate read and write
  only their own assessment, locks it once submitted, and gives admins read access to
  everyone. Admin status is an `admins` table + an `is_admin()` helper.
- **Scoring** runs client-side on submit and is stored on the assessment row. For
  higher-stakes use, move `score()` into an edge function so results can't be tampered
  with from the browser.

---

## Setup

### 1. Supabase project
1. Create a project at supabase.com.
2. **SQL editor →** paste and run `supabase/migrations/0001_init.sql`.
3. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up"
   (belt-and-braces; provisioning is done by the edge function).
4. **Authentication → URL Configuration → Redirect URLs:** add your Vercel URL and
   `http://localhost:5173` (both, e.g. `https://your-app.vercel.app`).

### 2. Resend
1. Create a Resend account and an API key.
2. For production, verify your sending domain and set `INVITE_FROM` to an address on
   it (e.g. `Strengths <noreply@yourdomain.com>`). Until then it falls back to
   Resend's shared `onboarding@resend.dev`, which only reliably delivers to your own
   address.

### 3. Edge functions
Install the Supabase CLI, then from the repo root:

```bash
supabase link --project-ref YOUR_PROJECT_REF

# secrets used by both functions
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set SITE_URL=https://your-app.vercel.app
supabase secrets set INVITE_FROM="Strengths <noreply@yourdomain.com>"

supabase functions deploy admin-invite
supabase functions deploy request-link --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — don't set them yourself.

### 4. Create the first admin
Admins can't be created from the UI. Make one auth user, then register it:

1. **Authentication → Users → Add user** (email + a throwaway password, or invite).
2. In the SQL editor, with that user's email:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'you@yourcompany.com';
```

That admin can now sign in via the login page (request a link) and invite candidates.

### 5. Frontend
```bash
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

### 6. Deploy to Vercel
1. Push to GitHub, import the repo in Vercel.
2. Set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` already rewrites all routes to `index.html` for the SPA
   router. Make sure `SITE_URL` (functions) and the Supabase redirect URLs match the
   deployed domain.

---

## Using it

- **/login** — anyone enters their email; only invited addresses receive a link.
- **/admin** — send invitations (admin only).
- **/admin/candidates** — status of every candidate; open completed ones to view or
  download their report.
- **/assessment** — the candidate's timed assessment (resumes if interrupted).
- **/result** — the candidate's own report + PDF download.

## Brand

ForzaMap's identity — lockup variants, clear space and minimum sizes, the icon
range, colour and type specs — is documented in [`docs/BRAND.md`](docs/BRAND.md),
with the full visual spec in `docs/ForzaMap-Brand-Handover.html`. Both are
reference documents; they are not served by the app.

Palette and type tokens live in `src/lib/ui.ts` (`PAPER`, `INK`, `MUTED`, `HAIR`,
`FORZA`, `LIFT`, `BODY`); the font stacks are set in `tailwind.config.js` and
`src/index.css`. Brand assets are served from `public/` and `public/brand/`.

## Notes / possible next steps
- `@react-pdf/renderer` is ~1 MB; `React.lazy` the report/PDF routes to keep the
  assessment flow light.
- Bulk invitations (paste a list of emails) is a small extension of the invite page.
- Server-side re-scoring on submit if you need tamper-proof results.
