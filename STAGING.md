# Staging

`main` is production. `staging` is the long-lived branch Sam QAs before that release.

Staging must use its own Firebase project. QA on the `staging` branch must not write production data. `APP_ENV=staging` selects that project. When `APP_ENV` is unset, the app keeps the built-in production config so production Vercel keeps working.

## Flow

1. Developers push to `staging`, or open a pull request into `staging`.
2. GitHub Actions runs the same CI workflow on pushes and pull requests to both `staging` and `main`.
3. Vercel’s Git integration deploys every non-`main` branch as a Preview. The stable URL for the `staging` branch is:

   [2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app](https://2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app)

   That follows Vercel’s branch alias `<project>-git-<branch>-<scope>.vercel.app`. This Vercel project is `2026-fit-testing-results-e-card` and the team scope is `shenqi1996s-projects`. Each push also gets its own `2026-fit-testing-results-e-card-<hash>-shenqi1996s-projects.vercel.app` URL. Use the git-staging alias for QA.
4. Sam QAs that live staging deploy against the staging Firebase project.
5. Sam merges `staging` into `main`. That merge is the production release. Production Vercel env vars stay pointed at `fit-test-result-e-card-2026`.

`vercel.json` only sets `buildCommand`, `installCommand`, `outputDirectory`, and the SPA rewrite to `index.html`. It does not set `git.deploymentEnabled` or an `ignoreCommand`, so it does not turn Preview deploys off.

## Staging Firebase project

The Spark project **`fit-test-result-e-card-staging`** already exists. Email/Password and Google sign-in are enabled. Firestore is in `nam5`, production mode. The rules currently published there are `main`'s [`firestore.rules`](./firestore.rules).

Web app config (the API key is not stored in this repo):

| Field | Value |
| --- | --- |
| `projectId` | `fit-test-result-e-card-staging` |
| `authDomain` | `fit-test-result-e-card-staging.firebaseapp.com` |
| `storageBucket` | `fit-test-result-e-card-staging.firebasestorage.app` |
| `messagingSenderId` | `966738964858` |
| `appId` | `1:966738964858:web:9a5324a2db3326169666c3` |
| `apiKey` | Vercel env var `FIREBASE_API_KEY` only. Copy it from Firebase → Project settings → Your apps. Do not commit it. |

`npm run seed:staging` refuses to run when the service account project id is the production project `fit-test-result-e-card-2026`.

## Seed fake data

Still requires a service account key. Project settings → Service accounts → Generate new private key. Save the JSON outside the repo. Do not commit it. `.gitignore` ignores `*serviceAccount*.json` and `*-firebase-adminsdk-*.json`.

From this repo, with Node 24:

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/staging-service-account.json
npm run seed:staging
```

The script uses the Firebase Admin SDK. It reads the project id from that key and exits without writing if the id is `fit-test-result-e-card-2026`. It creates four Auth users and these collections:

| Collection | What |
| --- | --- |
| `users` | `staging-superadmin@example.com` (`superadmin`, approved), `staging-admin@example.com` (`admin`, approved), `staging-tester@example.com` (`tester`, approved), `staging-pending@example.com` (`tester`, pending) |
| `fitTests` | One fake card, `userId` of the tester, `fitTester` `Staging Tester` |
| `fitTestVerifications` | Public verify doc for token `c0ffee00c0ffee00c0ffee00c0ffee00` |
| `fitTestLookups` | Public resend doc for Fake Client, DOB `01/15/1990`, `fake-client@example.com` |

New Auth users get password `Staging-only-1` unless you set `STAGING_SEED_PASSWORD` (at least 6 characters). Re-running the script updates the same docs. The current app treats role `admin` as staff. Role `superadmin` is stored for the separate super-admin change; until that is on `staging`, sign in as the staging admin account for Users management.

## Remaining manual steps

- [x] **Vercel Preview env vars, scoped to Git branch `staging`.** These are set: `APP_ENV=staging`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. Webpack inlines them with `EnvironmentPlugin`. If any `FIREBASE_*` value is missing while `APP_ENV=staging`, the build fails and does not use production.

  | Env var | Value |
  | --- | --- |
  | `APP_ENV` | `staging` |
  | `FIREBASE_API_KEY` | Staging web app API key, set only in Vercel |
  | `FIREBASE_AUTH_DOMAIN` | `fit-test-result-e-card-staging.firebaseapp.com` |
  | `FIREBASE_PROJECT_ID` | `fit-test-result-e-card-staging` |
  | `FIREBASE_STORAGE_BUCKET` | `fit-test-result-e-card-staging.firebasestorage.app` |
  | `FIREBASE_MESSAGING_SENDER_ID` | `966738964858` |
  | `FIREBASE_APP_ID` | `1:966738964858:web:9a5324a2db3326169666c3` |

  **Production env vars are optional.** Production Vercel has none of these today. Leave `APP_ENV` unset there. The built-in `fit-test-result-e-card-2026` config is the fallback, so production keeps working. Adding the six `FIREBASE_*` names to Vercel Production later is optional and does not change that build until `APP_ENV` is set. Locally, copy [`.env.example`](./.env.example) to `.env.local` and set `APP_ENV=staging` only when you intend to use the staging project. `.env.local` is gitignored.

- [ ] **Authorize the staging Vercel host** on the staging Firebase project. Authentication → Settings → Authorized domains. Add the hostname only (no `https://`):

  `2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app`

  Google sign-in fails until that host is listed. See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md).

- [ ] **Republish Firestore rules after PR #12 and PR #13 land on `staging`.** The rules in `fit-test-result-e-card-staging` today are `main`'s rules. Those pull requests are not merged into `staging` by this change. After Sam approves them onto `staging`, publish that branch's `firestore.rules` again:

  ```bash
  firebase deploy --only firestore:rules --project fit-test-result-e-card-staging
  ```

- [ ] **Service account key, then seed.** Generate the staging key as described above and run `npm run seed:staging`. The script will not write to `fit-test-result-e-card-2026`.

- [ ] **EmailJS.** The e-card sender still uses the EmailJS service, template, and public key compiled in `src/services/emailService.js`. For QA, use a test template or a sandbox service, and only the fake `example.com` addresses from the seed.

- [ ] **Optional.** Assign a custom domain to Git branch `staging` in Vercel, then add that hostname to the staging project's authorized domains. GitHub branch protection for `staging` is also still unset. Preview URLs can sit behind Vercel Deployment Protection.

GitHub Actions does not set `APP_ENV`, so its build uses the same production fallback as Vercel Production.
