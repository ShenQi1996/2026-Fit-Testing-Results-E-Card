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
- Fit tests older than three years are purged for the signed-in tester

Policies linked from the form: [next-leap-fit.vercel.app/legal](https://next-leap-fit.vercel.app/legal)

This app documents a qualitative fit-test result. It does **not** establish medical clearance or issue an OSHA certification.

## Run locally

Use **Node 24** (required). Do not run `npm start dev` — webpack treats `dev` as an extra entry and fails.

```bash
nvm install 24
nvm use 24
cd email-form-app
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Staff app: [http://localhost:3000/staff_login](http://localhost:3000/staff_login).

```bash
npm run build      # production bundle in dist/
npm run build:dev  # development bundle only; does not start a server
```

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

## Deploy

Vercel build: `npm run build`, output `dist/`. See [`vercel.json`](./vercel.json) for SPA rewrites.

Add the production hostname to Firebase **Authorized domains** before testing Google sign-in. Per-deployment `*.vercel.app` URLs are not authorized.

---

**Secure Fit LLC** — Precision in every breath.
