# GWP Request & Inventory System — Phase 1

Phase 1 covers: Google sign-in, the Home screen, and the full **SKU & Barcode
Request** module (list, new/edit form in four sections, Approve/Reject with a
required reason, remarks, and collapsible activity history). It talks
directly to the Supabase project whose schema you already ran.

## 1. Configure Google sign-in (do this once)

Supabase needs its own Google OAuth client — separate from anything else
your company already has.

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or
   reuse) a project, then **APIs & Services → Credentials → Create
   Credentials → OAuth client ID** (type: Web application).
2. Under **Authorized redirect URIs**, add:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   (find `YOUR-PROJECT-REF` in Supabase → Settings → API → Project URL).
3. Copy the **Client ID** and **Client Secret**.
4. In Supabase → **Authentication → Providers → Google**, paste them in and
   enable the provider.
5. In Supabase → **Authentication → URL Configuration**, set:
   - **Site URL**: your future Netlify URL (e.g. `https://your-app.netlify.app`)
   - **Redirect URLs**: add the same URL

You can come back and update step 5 once you know your real Netlify URL.

## 2. Local setup (optional, to test before deploying)

```bash
npm install
cp .env.example .env
# edit .env with your Supabase URL + anon key (Settings > API)
npm run dev
```

## 3. Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-and-drop the folder into
   Netlify's "Deploy manually" if you don't want GitHub yet).
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command: `npm run build` — Publish directory: `dist`
   (both are already set in `netlify.toml`, so Netlify should pick them up
   automatically).
4. Under **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same two values as your `.env`)
5. Deploy. Once it's live, go back to Supabase's URL Configuration (step 1.5
   above) and make sure the Netlify URL is set correctly, then redeploy if
   you changed it after the first deploy.

## 4. Adding your team

Don't invite anyone until you've checked the app works for you first:

1. Sign in yourself once (this creates your `profiles` row with role
   defaulted to `ComOps`).
2. In Supabase → Table Editor → `profiles`, change your own row's `role` to
   `Admin` so you can see every section of a request while testing.
3. Once you're happy, share the Netlify URL with the team. Each person's
   first Google sign-in creates their own `profiles` row (role defaults to
   `ComOps` — update DSP/Warehouse/Admin roles the same way, directly in the
   table, until an Admin screen exists for it).

## What's stubbed for later (not silently broken — just not built yet)

- **Email/Slack notifications**: Reject actions already write a row to
  `notifications_log`, but nothing sends the actual email or Slack message
  yet. That needs a Supabase Edge Function calling a mail provider (e.g.
  Resend) and/or a Slack webhook — a Phase 2 item once you have those
  credentials.
- **Other five modules** (Planned GWP/Bundling, Forecast GWP, Analysis,
  Reference, Admin): show as "Coming soon" cards on Home. Same patterns as
  this module, built next.
- **Column-level permission trigger**: the database already blocks (via
  `guard_sku_request_columns`) a ComOps user from writing DSP/Warehouse
  fields directly through the API, even if someone bypassed the UI.
