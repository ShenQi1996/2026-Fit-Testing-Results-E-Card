# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Optional "Remind me next year when my fit test is due" box under Optional consent on the card form, unchecked by default and saved on the fit test as `renewalReminderOptIn`. Drafts keep it, the result card shows it, and the public verify and resend copies do not carry it
- Daily renewal reminder job (`.github/workflows/renewal-reminders.yml`, 09:00 UTC, plus a manual run that is a dry run by default) running `scripts/send-renewal-reminders.js`. It emails opted-in workers whose passed, sent, not-deleted test is 335 to 365 days old through a new EmailJS renewal template, skips anyone with a later test on file, marks each record with `renewalReminderSentFor` and `renewalReminderSentAt` so it sends once, caps a run at 50 emails about one per second, and only emails `@example.com` on staging. Scheduled runs start only once the workflow is on `main`, and it does nothing until the `FIREBASE_SERVICE_ACCOUNT`, `EMAILJS_SERVICE_ID`, `EMAILJS_RENEWAL_TEMPLATE_ID`, and `EMAILJS_PUBLIC_KEY` secrets exist (`EMAILJS_PRIVATE_KEY` optional). Setup steps are in `docs/renewal-reminders.md`
- `firestore.rules`: `renewalReminderOptIn` must be a bool on fit test create and on drafts, and a fit test create cannot set `renewalReminderSentFor` or `renewalReminderSentAt`. Edits and resends still cannot change these fields. Republish staging rules before deploying this build

### Changed

- The app bundle is split by page. The form, results, users, account, verify, and resend pages each load their own chunk the first time they open, behind a small CSS loading indicator; a chunk that fails to download shows a reload message instead of a blank page. Login and the home page stay in the main bundle
- jspdf and html2canvas load only when a PDF is previewed or downloaded, and EmailJS loads only when an e-card is sent
- Removing a school from the Schools list also removes it from every user, after a confirm that says how many users change. It leaves each `schools` list. A user whose main `school` it was moves to the first school left in their `schools` list, or to Leave unset (`school: ''`) when none are left; those users can still save drafts but cannot save fit tests or send e-cards until a school is picked. Faculty keep the school because they must have one, and are named for reassignment. Role, status, and fit-test records do not change. More than 498 affected users take several batches with no rollback if a later one fails. User cards mark a school that is no longer on the list, drop it on save, and super admins get a one-step cleanup for names left behind by earlier removals
- `firestore.rules`: a super admin may set another non-faculty user's `school` to `''` (Leave unset). Before this, choosing Leave unset for a user who already had a school was rejected by the rules. Republish staging rules before deploying this build
- Adding, saving, and deleting a school, saving or deleting a user, and Update Account show a spinner with Adding… / Saving… / Deleting… text, disable the buttons while the write runs, and ignore a second click
- The loading and verify animations use the svg-only Lottie build (`LottieSvg`), which keeps expressions, and the loading animation's engine loads on demand

## [1.2.0] - 2026-11-13

### Added

- Medical restriction notes are stored apart from fit test records, in `fitTestMedicalNotes`, which only the record owner and in-scope admins can read. A fit test create cannot include the note. Older records that still carry notes on the fit test keep them until an in-scope admin edits the record; that edit moves the notes into `fitTestMedicalNotes` and removes them from the fit test in the same batch (#41)
- School program administrator name and contact are stored on schools and user profiles. Selecting a school copies them onto the fit test record, field by field: the school's value is used when set, and a blank school field falls back to the signed-in user's profile value. The send form no longer asks for them (#33)
- Respirator style dropdown with exactly Cup (molded), Flat-fold, and Duckbill, required on the add and edit forms. Records with no style, or an earlier style value, still display and verify as stored; editing one requires choosing a style before saving
- MIT license (`LICENSE`, copyright 2026 Secure Fit LLC)
- Security policy (`SECURITY.md`): private reports to SecureFit2024@gmail.com, latest `main` supported, reply aimed within 7 days
- Contributor Covenant 2.1 code of conduct (`CODE_OF_CONDUCT.md`)
- Contributing guide (`CONTRIBUTING.md`)
- Code owners (`.github/CODEOWNERS`)
- GitHub issue templates and pull request template
- GitHub Actions CI workflow on push and pull request to `main` and `staging` (and manual runs), with three jobs: build (`npm ci`, lint, `npm run build`, `npm test`), rules (`npm run test:rules` on the Firestore emulator), and config builds (a staging-config build with a dummy project, plus a no-env build that must keep the production Firebase config)

### Changed

- OSHA 1910.134(m) record rules (#40):
  - Fit test result and issue date are locked after create, and every later edit writes an edit history entry in the same batch
  - Fit test records are kept with a soft delete that needs a reason; hard delete is denied. Soft delete is limited to in-scope admins and revokes the public cards, and new fit tests are stamped `deletedAt: null`
  - Respirator make, model, style, size, and test type are required and cannot be cleared on edit
  - Every new fit test is recorded as Qualitative with no fit factor. Legacy Quantitative records keep their stored method and fit factor on edit

### Fixed

- Verify and resend copies now carry the program administrator fields from the fit test; the public verify page and the emailed card still do not print them (#43)
- Card copies carry a legacy Quantitative record's stored fit factor, so the in-app card, public verify page, emailed card, and PDF show it; new tests stay qualitative with no fit factor
- Soft delete and edit failures keep the Firestore error code in the message, and the results page shows that message instead of generic text
- The emailed card HTML-escapes the respirator style

## [1.2.0] - 2026-10-23

### Added

- MIT license (`LICENSE`, copyright 2026 Secure Fit LLC)
- Security policy (`SECURITY.md`): private reports to SecureFit2024@gmail.com, latest `main` supported, reply aimed within 7 days
- Contributor Covenant 2.1 code of conduct (`CODE_OF_CONDUCT.md`)
- Contributing guide (`CONTRIBUTING.md`)
- Code owners (`.github/CODEOWNERS`)
- GitHub issue templates and pull request template
- GitHub Actions CI workflow that runs `npm ci` and `npm run build` on push and pull request to `main`
