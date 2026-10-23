# Staging

`main` is production. `staging` is the long-lived branch Sam QAs before that release.

## Flow

1. Developers push to `staging`, or open a pull request into `staging`.
2. GitHub Actions runs the same CI workflow on pushes and pull requests to both `staging` and `main`.
3. Vercel’s Git integration deploys every non-`main` branch as a Preview. The stable URL for the `staging` branch is:

   [2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app](https://2026-fit-testing-results-e-card-git-staging-shenqi1996s-projects.vercel.app)

   That follows Vercel’s branch alias `<project>-git-<branch>-<scope>.vercel.app`. This project is `2026-fit-testing-results-e-card` and the team scope is `shenqi1996s-projects`. Each push also gets its own `2026-fit-testing-results-e-card-<hash>-shenqi1996s-projects.vercel.app` URL. Use the git-staging alias for QA.
4. Sam QAs that live staging deploy.
5. Sam merges `staging` into `main`. That merge is the production release.

`vercel.json` only sets `buildCommand`, `installCommand`, `outputDirectory`, and the SPA rewrite to `index.html`. It does not set `git.deploymentEnabled` or an `ignoreCommand`, so it does not turn Preview deploys off.

## Manual setup

These steps are outside the repo. Nothing here changes Vercel, Firebase, or GitHub branch protection.

- [ ] **Optional staging domain.** Vercel → this project → Settings → Domains. Assign a staging hostname to the Git branch `staging`.
- [ ] **Preview environment variables.** Vercel → Settings → Environment Variables. Add any values the Preview environment needs. Production variables are not copied to Preview automatically.
- [ ] **Same Firebase project.** Staging uses Firebase project `fit-test-result-e-card-2026` and the live production data unless a separate Firebase project is configured and the Preview environment points at it. Creating or editing a record on staging changes production data.
- [ ] **Branch protection for `staging`.** GitHub → Settings → Branches → add a rule for `staging` (pull request required, and the CI check required). This change does not enable that rule.

Google sign-in on a `*.vercel.app` Preview hostname fails until that hostname is listed under Firebase Authentication → Settings → Authorized domains, or until QA uses the custom staging domain from the first step. See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md). Preview deployments can also sit behind Vercel Deployment Protection.
