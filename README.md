# Secure Fit LLC — Fit Test E-Card App

Staff app for testers to record qualitative respirator fit tests, email branded e-cards, and keep digital records. Clients can verify a card or request a resend without signing in.

**Production:** [2026-fit-testing-results-e-card.vercel.app](https://2026-fit-testing-results-e-card.vercel.app)

## Routes

| Path | Who | What |
|------|-----|------|
| `/` | Public | Home: verify, resend, or open staff login |
| `/verify` and `/verify/:token` | Public | Confirm an e-card is authentic |
| `/resend` | Public | Resend a lost e-card (name, DOB, and email must match) |
| `/staff_login` | Staff | Testers and admins only |

A logged-in session does **not** take over `/`, `/verify`, or `/resend`. Staff work stays at `/staff_login`.

## Features

- Fit test form: client, respirator, protocol, hygiene, consent, and signatures
- Participant consent (required): medical restrictions, participation, privacy, record delivery
- Optional: employer/school release, marketing email
- Tester attestation, including required **Were medical restrictions received?** (Yes/No; Yes opens a note)
- E-card QR points to `/verify/:token` (not booking). Booking is a separate follow-up link (Harlem or Brooklyn)
- Public verification statuses: valid, expired, failed (authentic, did not pass), invalid
- Test results: month/school/location filters, CSV export, PDF, resend, admin edit/delete
- Admin approval for new testers; Users page for admins
- Records saved to Firestore **before** email so the QR works as soon as the card arrives
- Fit tests older than three years stay in Firestore and are hidden from lists and counts

Policies linked from the form: [next-leap-fit.vercel.app/legal](https://next-leap-fit.vercel.app/legal)

This app documents a qualitative fit-test result. It does **not** establish medical clearance or issue an OSHA certification.

## Running locally

> **Warning:** `npm start` (`webpack serve --mode=development`) refuses to boot without staging Firebase keys. It does not fall back to production. A production build (`npm run build`, `--mode=production`) with `APP_ENV` unset still uses live data.

1. Prerequisite: Node 24.
2. `npm install`.
3. Copy [`.env.example`](./.env.example) to `.env.local`. `.env.local` is gitignored.
4. Fill in `FIREBASE_API_KEY` with the staging key. `APP_ENV=staging` is already set in the example. `--mode=development` sets it to `staging` when it is missing.
5. `npm start`. Do not run `npm start dev`. Webpack treats `dev` as an extra entry and fails. Open [http://localhost:3000](http://localhost:3000). If a staging key is missing, webpack exits and names the missing variable.
6. Before doing anything else, confirm the **STAGING** banner appears at the top of the app.

Optional seed: set `GOOGLE_APPLICATION_CREDENTIALS` to the staging service account JSON (kept outside the repo), run `npm run seed:staging -- --dry-run` first, then `npm run seed:staging`. For the four test logins, set `SEED_PASSWORD` and add `--with-auth`. The script refuses to run against production.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
npm run seed:staging -- --dry-run
npm run seed:staging
```

```bash
export SEED_PASSWORD='your-password'
npm run seed:staging -- --with-auth
```

Until the super-admin roles PR is on staging, sign in as `test-person-02@example.com` (admin) for user management.

`npm test` and `npm run lint`.

Details are in [STAGING.md](./STAGING.md).

## Running in production

`npm run build` with `APP_ENV` unset uses the built-in production Firebase project `fit-test-result-e-card-2026` and shows no **STAGING** banner. That is live data, so be careful. Do not use the dev server for that project.

Production Vercel sets no `APP_ENV` or `FIREBASE_*` variables. The staging web API key is stored only in Vercel and is not in git. Those production builds keep the Firebase web config already compiled for `fit-test-result-e-card-2026`. `main` is production. `staging` is the long-lived branch Sam QAs before a release. The production release is Sam merging `staging` into `main`. After that merge, production still has none of these environment variables, so it keeps today's Firebase project.

`npm start` and `npm run build:dev` fail if any `FIREBASE_*` value is missing or matches production. webpack does not set `NODE_ENV` before it loads `webpack.config.js`, so that guard uses `--mode=development`. A production build with `APP_ENV=staging` does the same key check. Any other `APP_ENV` value on a production build (for example `Staging`) prints a warning and keeps the production config. `--mode=development` rejects that value instead of using production.

Production EmailJS sending is unchanged. The production service id, template id, and public key stay compiled in the app, and sending when `APP_ENV` is unset is the same as today.

The seed script refuses every project except `fit-test-result-e-card-staging`, including `fit-test-result-e-card-2026`. Do not use a service account key from the production project.

Add the production hostname to Firebase **Authorized domains** before testing Google sign-in. Per-deployment `*.vercel.app` URLs are not authorized.

GitHub Actions runs the CI job on pushes and pull requests to both `main` and `staging`. See [STAGING.md](./STAGING.md).

## Firestore (required for verify and resend)

Public verify and resend read one document by known key. Listing those collections is denied.

1. Open Firebase Console → Firestore → **Rules**
2. Publish the contents of [`firestore.rules`](./firestore.rules) in this repo
3. Create the composite index if Test Results asks for it: `fitTests` with `userId` ascending, `createdAt` descending

Until `fitTestVerifications` rules are published, `/verify` cannot confirm cards.

Collections:

- `users` — testers/admins (`role`, `status`)
- `users/{uid}/solutionProfiles` and `schoolProfiles`
- `fitTests` — records (owner or admin)
- `fitTestLookups/{lookupKey}` — public get for resend
- `fitTestVerifications/{token}` — public get for verify

## Staff workflow

1. Sign in at `/staff_login` (approved testers only)
2. Complete the form with the participant
3. Confirm required consents and tester Yes/No items
4. Sign, then send — record is stored, then the e-card is emailed
5. Use **Test results** to resend, export, or inspect full consent

New accounts need **admin approval** before they can send records.

## Project layout

```
src/
  App.js                         # Public vs staff routing
  components/
    auth/                        # Login, signup (admin-created), account
    admin/                       # Users management
    common/                      # Header, sidebar, home, form controls
    forms/                       # Fit test form sections + consent
    lookup/                      # Verify and resend pages
    results/                     # Test results
  constants/                     # Consent copy, form options
  context/                       # Auth and theme
  hooks/useFitTestForm.js
  services/                      # Firebase + EmailJS
  utils/                         # Card HTML, tokens, PDF, CSV, dates
firestore.rules
vercel.json                      # SPA rewrites to index.html
```

## Documentation

- [FIRESTORE_RULES_SETUP.md](./FIRESTORE_RULES_SETUP.md) — publish rules for verify/resend
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) — project, Auth, Firestore, indexes
- [EMAILJS_SETUP.md](./EMAILJS_SETUP.md) — e-card email template
- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) — Vercel domain and Google sign-in
- [STAGING.md](./STAGING.md) — staging branch, Preview URL, and QA before main

## Deploy

Vercel build: `npm run build`, output `dist/`. See [`vercel.json`](./vercel.json) for SPA rewrites.

Local staging setup and the production Firebase fallback are in [Running locally](#running-locally) and [Running in production](#running-in-production). See also [STAGING.md](./STAGING.md) and [`.env.example`](./.env.example).

Add the production hostname to Firebase **Authorized domains** before testing Google sign-in. Per-deployment `*.vercel.app` URLs are not authorized.

---

**Secure Fit LLC** — Precision in every breath.
