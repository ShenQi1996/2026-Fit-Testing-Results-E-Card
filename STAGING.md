# Staging

`main` is production. `staging` is the long-lived branch Sam QAs before that release.

Staging must use its own Firebase project. QA writes must not land in production. The client has no baked-in project config: a build fails when the Firebase env vars are missing.

## Flow

1. Developers push to `staging`, or open a pull request into `staging`.
2. GitHub Actions runs the same CI workflow on pushes and pull requests to both `staging` and `main`.
3. Vercel’s Git integration deploys every non-`main` branch as a Preview. The stable URL for the `staging` branch is:

   [2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app](https://2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app)

   That follows Vercel’s branch alias `<project>-git-<branch>-<scope>.vercel.app`. This Vercel project is `2026-fit-testing-results-e-card` and the team scope is `shenqi1996s-projects`. Each push also gets its own `2026-fit-testing-results-e-card-<hash>-shenqi1996s-projects.vercel.app` URL. Use the git-staging alias for QA.
4. Sam QAs that live staging deploy against the staging Firebase project.
5. Sam merges `staging` into `main`. That merge is the production release. Production Vercel env vars stay pointed at `fit-test-result-e-card-2026`.

`vercel.json` only sets `buildCommand`, `installCommand`, `outputDirectory`, and the SPA rewrite to `index.html`. It does not set `git.deploymentEnabled` or an `ignoreCommand`, so it does not turn Preview deploys off.

## Set up the staging Firebase project (Spark)

Do this once. The free Spark plan is enough. Nothing in this repo creates the Firebase project for you.

1. **Create the project.** [Firebase console](https://console.firebase.google.com/) → Add project. Name it `fit-test-result-e-card-staging`. Leave it on the Spark plan. Do not use `fit-test-result-e-card-2026`.
2. **Add a web app and copy the config.** Project settings → Your apps → Web (`</>`). Register the app. Copy the config values into the env var names below. Those values are the only connection between this repo and the staging project.
3. **Turn on sign-in providers.** Authentication → Sign-in method → enable **Email/Password** and **Google**.
4. **Authorize the staging host.** Authentication → Settings → Authorized domains → Add domain. Add the hostname only (no `https://`):

   `2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app`

   Also add a custom staging domain if you assign one in the next section. Google sign-in fails on a host that is not in this list. See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md).
5. **Create Firestore.** Build → Firestore Database → Create database. Pick a region and start in production mode. Spark includes Firestore.
6. **Publish the rules.** Firestore → Rules → paste [`firestore.rules`](./firestore.rules) from this repo → Publish. Or, after `firebase login`:

   ```bash
   firebase deploy --only firestore:rules --project fit-test-result-e-card-staging
   ```

7. **Create a service account key for the seed script.** Project settings → Service accounts → Generate new private key. Save the JSON outside the repo. Do not commit it. `.gitignore` ignores `*serviceAccount*.json` and `*-firebase-adminsdk-*.json`.
8. **Seed fake data.** From this repo, with Node 24:

   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/staging-service-account.json
   npm run seed:staging
   ```

   The script uses the Firebase Admin SDK. It reads the project id from that key and **exits without writing** if the id is `fit-test-result-e-card-2026`. It creates four Auth users and these collections:

   | Collection | What |
   | --- | --- |
   | `users` | `staging-superadmin@example.com` (`superadmin`, approved), `staging-admin@example.com` (`admin`, approved), `staging-tester@example.com` (`tester`, approved), `staging-pending@example.com` (`tester`, pending) |
   | `fitTests` | One fake card, `userId` of the tester, `fitTester` `Staging Tester` |
   | `fitTestVerifications` | Public verify doc for token `c0ffee00c0ffee00c0ffee00c0ffee00` |
   | `fitTestLookups` | Public resend doc for Fake Client, DOB `01/15/1990`, `fake-client@example.com` |

   New Auth users get password `Staging-only-1` unless you set `STAGING_SEED_PASSWORD` (at least 6 characters). Re-running the script updates the same docs. The current app treats role `admin` as staff. Role `superadmin` is stored for the separate super-admin change; until that is merged, sign in as the staging admin account for Users management.

9. **Point Vercel at the two projects.** Vercel → this project → Settings → Environment Variables.

   Set these six for **Production** to the current project `fit-test-result-e-card-2026` (Firebase → Project settings → Your apps → SDK setup):

   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID` = `fit-test-result-e-card-2026`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

   Set the same six again for **Preview**, and in the branch picker limit them to Git branch `staging`, using the **staging** web app config (`FIREBASE_PROJECT_ID` = `fit-test-result-e-card-staging`). Production values are not copied to Preview. A Preview build of `staging` fails if these are missing, instead of falling back to production.

   Do the Production values **before** this change is deployed, or the production Vercel build fails closed.

   Locally, copy [`.env.example`](./.env.example) to `.env.local` and fill in whichever project you are running. `.env.local` is gitignored.

10. **EmailJS.** The e-card sender still uses the EmailJS service, template, and public key compiled in `src/services/emailService.js`. Staging Firestore is separate, but a sent card still goes out through that EmailJS account. For QA, use an EmailJS test template or a sandbox service, and only the fake `example.com` addresses from the seed, so a test send does not reach a real person.

## Other manual setup

- [ ] **Optional staging domain.** Vercel → Settings → Domains. Assign a hostname to Git branch `staging`, then add that hostname under the staging project’s Firebase Authorized domains.
- [ ] **Branch protection for `staging`.** GitHub → Settings → Branches → add a rule for `staging` (pull request required, and the CI check required). This repo change does not enable that rule.
- [ ] **Vercel Deployment Protection.** Preview URLs can sit behind a Vercel login. Adjust it if someone outside the team needs to open the staging alias.

GitHub Actions compiles with placeholder Firebase values (`ci-not-production`). Those placeholders are not a real project and are not used by Vercel.
