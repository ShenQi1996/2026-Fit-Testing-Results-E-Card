# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-11-13

### Added

- Medical restriction notes are stored apart from fit test records, in `fitTestMedicalNotes`, which only the record owner and in-scope admins can read. A fit test create cannot include the note, and notes already on older records are left as they are (#41)
- School program administrator name and contact are stored on schools and user profiles. Selecting a school copies them onto the fit test record, and the send form no longer asks for them (#33)
- Respirator style dropdown with exactly Cup (molded), Flat-fold, and Duckbill, required on the add and edit forms. Records with no style, or an earlier style value, still display and verify as stored; editing one requires choosing a style before saving
- MIT license (`LICENSE`, copyright 2026 Secure Fit LLC)
- Security policy (`SECURITY.md`): private reports to SecureFit2024@gmail.com, latest `main` supported, reply aimed within 7 days
- Contributor Covenant 2.1 code of conduct (`CODE_OF_CONDUCT.md`)
- Contributing guide (`CONTRIBUTING.md`)
- Code owners (`.github/CODEOWNERS`)
- GitHub issue templates and pull request template
- GitHub Actions CI workflow that runs `npm ci` and `npm run build` on push and pull request to `main`

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
