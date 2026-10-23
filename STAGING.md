# Staging

`main` is production. `staging` is the long-lived branch Sam QAs before a release. This pull request targets `staging`. It does not merge anything into `main`.

Production Vercel does not set `APP_ENV` or any `FIREBASE_*` variable. Those builds keep the Firebase web config already compiled for `fit-test-result-e-card-2026`. A staging build sets `APP_ENV` to exactly `staging` and must supply every `FIREBASE_*` value. The build fails if one is missing. It also fails when any trimmed `FIREBASE_*` value contains `fit-test-result-e-card-2026` in any case, or when the API key, app id, or messaging sender id matches production. Any other `APP_ENV`, including `Staging`, keeps the production Firebase config and prints a build warning.

## Flow

1. Developers push to `staging`, or open a pull request into `staging`.
2. GitHub Actions runs the existing CI job on pushes and pull requests to both `main` and `staging`. It also builds once with `APP_ENV=staging` and dummy Firebase values, and once with those variables empty.
3. Vercel deploys the `staging` branch to the stable alias [securefit-ecard-staging.vercel.app](https://securefit-ecard-staging.vercel.app). That host is assigned to Git branch `staging`.
4. Sam QAs on that URL. The app shows a small **STAGING** banner. Data goes to Firebase project `fit-test-result-e-card-staging`, not production.
5. Sam merges `staging` into `main`. That merge is the production release. Production still has none of these environment variables, so it keeps today's Firebase project.

`vercel.json` sets `buildCommand`, `installCommand`, `outputDirectory`, and the SPA rewrite to `index.html`. It does not set `git.deploymentEnabled` or an `ignoreCommand`, so it does not turn branch deploys off.

## Already configured

Vercel project `2026-fit-testing-results-e-card`. Preview environment variables are limited to Git branch `staging`:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `staging` |
| `FIREBASE_API_KEY` | Staging web API key, stored only in Vercel |
| `FIREBASE_AUTH_DOMAIN` | `fit-test-result-e-card-staging.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `fit-test-result-e-card-staging` |
| `FIREBASE_STORAGE_BUCKET` | `fit-test-result-e-card-staging.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | `966738964858` |
| `FIREBASE_APP_ID` | `1:966738964858:web:9a5324a2db3326169666c3` |

`FIREBASE_API_KEY` is not in git. Production Vercel has none of these variables.

The staging branch of this repo exists and points at the same commit as `main` until this pull request is merged into `staging`.

## EmailJS

`src/services/emailService.js` still contains the production EmailJS service id, template id, and public key. When `APP_ENV` is unset, sending is unchanged.

When `APP_ENV` is exactly `staging`, send and resend accept one trimmed address and pass that same string to EmailJS. The address must be a single `example.com` mailbox: commas, semicolons, quotes, question marks, spaces, and a second `@` are refused. Seeded cards use only `@example.com` addresses, so a resend of seed data does not reach a real customer. A real address typed into the staging form is saved on the staging Firebase project and the email is blocked. There is no separate staging EmailJS account. Do not remove this guard to test with a live inbox.

## Seed fake data

`npm run seed:staging` writes fake Firestore documents with the Admin SDK. It reads the service account from `GOOGLE_APPLICATION_CREDENTIALS`, then refuses to run unless that file's `project_id` is exactly `fit-test-result-e-card-staging`. Production id `fit-test-result-e-card-2026` is refused. Any other project id is refused.

The script is idempotent. Document ids are fixed (`seed-user-*`, 20-character `fitTests` ids, lookup ids are the app's 64-hex SHA-256 keys, verification ids are 32-hex tokens). Re-runs call `set()` and overwrite those documents. It never deletes a document, including documents that are not part of the seed.

Names are `Test Person 01` and similar. Every email is `@example.com`. Dates of birth are fake.

| Collection | What |
| --- | --- |
| `users` | `test-person-01@example.com` (`superadmin`, approved, `provider` `google.com`), `test-person-02@example.com` (`admin`, approved), `test-person-03@example.com` (`tester`, approved), `test-person-04@example.com` (`tester`, pending) |
| `users/seed-user-tester/solutionProfiles` | Bitrex and Saccharin profiles. The seed does not write `schoolProfiles`. |
| `fitTests` | Legacy card (no `expirationDate`, no `testLocation`), full card, full card missing `testLocation` (`Makrite sekura`), newest card, and a newest **Fail** |
| `fitTestLookups` | One doc per card. The legacy lookup omits `testCreatedAtMs` and `verificationToken`. Newer lookups match the card, including the integer `testCreatedAtMs` |
| `fitTestVerifications` | 14 fields, no date of birth or email. Document id is the token. Legacy expiration is the issue date plus one year |

User document ids, which `--with-auth` also uses as Auth uids:

- `seed-user-superadmin`
- `seed-user-admin`
- `seed-user-tester`
- `seed-user-pending`

Resend the newest card with name `Test Person 14`, DOB `08/08/1994`, email `test-person-14@example.com`. Verify token `a1000000000000000000000000000004`.

The current app on `main` treats role `admin` as staff. Role `superadmin` is stored for PR #13. Until that lands on `staging`, sign in as `test-person-02@example.com` for Users management.

### Run

In the [staging Firebase console](https://console.firebase.google.com/) for `fit-test-result-e-card-staging`: Project settings → Service accounts → Generate new private key. Save the JSON outside the repo. Do not commit it. `.gitignore` ignores `*serviceAccount*.json` and `*-firebase-adminsdk-*.json`.

From this repo, with Node 24:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
npm run seed:staging -- --dry-run
npm run seed:staging
```

`--dry-run` checks the project id and prints the document paths. It does not write.

To create matching email/password Auth users (optional):

```bash
export SEED_PASSWORD='choose-a-password-at-least-6-characters'
npm run seed:staging -- --with-auth
```

The password is only read from `SEED_PASSWORD`. It is not stored in the script and it is not printed. Re-running `--with-auth` updates those four uids. If an email already belongs to a different uid, the script stops and does not delete that user.

## Backfill tester schools

`npm run backfill:schools` reads staging Firestore with the Admin SDK and fills `school` on tester user documents. Dry run is the default. It prints every school value found on fit test records, with a count of occurrences, then the planned updates and the skip list. It writes nothing.

`--write` sets `school` on each planned tester document. No other field is changed.

The script reads `GOOGLE_APPLICATION_CREDENTIALS` the same way as `npm run seed:staging`. The Admin SDK bypasses Firestore rules, so the project check is what keeps this off production. It refuses every project except `fit-test-result-e-card-staging`. Production id `fit-test-result-e-card-2026` is refused before the Admin SDK connects, from `FIREBASE_PROJECT_ID` when that variable is set and from the service account `project_id`. It is refused again from the initialized app's project id.

The script loads every `users` document whose `role` is `tester`. A tester who already has a non-blank `school` is skipped, and that tester's fit tests are not read. For each remaining tester it reads `fitTests` where `userId` equals that uid. The school comes from `schoolsList`, or from `schoolName` when a record has that field. `testLocation` (`Harlem`, `Brooklyn`, `Other`) is a location and is left unused. Saved `schoolProfiles` are left unread.

The only school the script will write is `Helene College of Nursing`, the single value in `SCHOOLS_OPTIONS` (`src/constants/fitTestOptions.js`). Any other value is unrecognized. That tester is reported and skipped. Testers with no fit test records, records with no school, or more than one school across their records are also skipped and reported.

Seeded fit tests store `schoolsList` `Example Training School`. The legacy seed card has no `schoolsList`. School profiles store `Example Training School` and `Example Second School`. Those seed strings are unrecognized, so a dry run against seed data skips `seed-user-tester` and writes no `school`. Real staging values are whatever the dry run prints. This script does not guess past `Helene College of Nursing`.

`school` is the single school name on a tester document. This script does not import the school-scoped admin code. It only writes that field.

### Run

Use the staging service account from the seed section. Do not use a key from `fit-test-result-e-card-2026`.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/staging-service-account.json
npm run backfill:schools
npm run backfill:schools -- --write
```

There is no `--dry-run` flag. A run with no flag is the dry run. It still connects, because it has to read testers and fit tests. `--write` is the run that updates documents.

## Remaining manual steps

- [ ] **Service account key, then seed.** Generate the staging key as above. Run the dry run, then run the script without `--dry-run`. Do not use a key from `fit-test-result-e-card-2026`.
- [ ] **Backfill tester schools.** With that same staging key, run `npm run backfill:schools` and read the printed school values. Run `npm run backfill:schools -- --write` when those values are the ones that should be stored. The script writes `school` and leaves every other field unchanged.
- [ ] **Staging test Auth accounts.** Prefer `npm run seed:staging -- --with-auth` so the Auth uids match `seed-user-superadmin`, `seed-user-admin`, `seed-user-tester`, and `seed-user-pending`. Creating the same emails in the Firebase console assigns different uids, and those sign-ins will not see the seeded role until a `users/{that-uid}` document exists.
- [ ] **Authorized domain.** On project `fit-test-result-e-card-staging`, Authentication → Settings → Authorized domains, add the hostname `securefit-ecard-staging.vercel.app` (no `https://`). Google sign-in fails until that host is listed.
- [ ] **Republish Firestore rules after PR #12 and PR #13 land on `staging`.** This change does not merge those pull requests. PR #12 creates a profile on email sign-in. PR #13 adds role `superadmin`. After they are on `staging`, publish that branch's `firestore.rules` to the staging project:

  ```bash
  firebase deploy --only firestore:rules --project fit-test-result-e-card-staging
  ```

- [ ] **Vercel SSO.** Project deployment protection is SSO for every deployment except custom domains. `securefit-ecard-staging.vercel.app` is a `vercel.app` host, so it may still ask for a Vercel login before the app loads. That setting was left as it is.

Local staging build, if you need one, copy [`.env.example`](./.env.example) to `.env.local` and set `FIREBASE_API_KEY` from the staging web app. `.env.local` is gitignored.
