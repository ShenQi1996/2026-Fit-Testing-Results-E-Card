# Firestore security rules

Public **verify** (`/verify/:token`) and **resend** (`/resend`) only work after these rules are published. If `/verify` says verification is not enabled, the live Firebase project is still on older rules.

## Publish

Before publishing, confirm the super admin user document has `role` set to `superadmin` and `status` set to `approved`. That was already confirmed on Oct 23, 2026. These rules do not grant `superadmin` from the client. A missing `superadmin` document would lock admin management after publish.

1. Open [Firebase Console](https://console.firebase.google.com/) → your project
2. **Firestore Database** → **Rules**
3. Paste the full contents of [`firestore.rules`](./firestore.rules) from this repo
4. Click **Publish**
5. Reload the app and test `/verify/:token` and `/resend`

Do not invent a shorter rule set. Older snippets in past docs omitted `fitTestVerifications` and `fitTestLookups`, which breaks the public pages. Do not deploy this file until the super admin role above is confirmed.

## What the rules allow

| Collection | Read | Write |
|------------|------|--------|
| `users` | Owner or admin (super admin counts as admin) | Create pending testers; owner cannot change `role`/`status`; admins may change only a tester's `role` and `status` (role stays `tester`); only a super admin changes role to or from `admin` or `superadmin`, or edits name and email; no client create sets `superadmin` |
| `solutionProfiles` / `schoolProfiles` | Approved owner | Approved owner |
| `fitTests` | Approved owner or admin | Approved owner or admin |
| `fitTestLookups/{lookupKey}` | Public **get** of one doc if the key is known | Approved staff create/update; owner or admin delete |
| `fitTestVerifications/{token}` | Public **get** of one doc if the token is known | Approved staff create/update; owner or admin delete |
| `emailSendLog/{userId}` | Approved owner of that uid | Approved owner create/update; no delete or list |

`list` is denied on the public collections so they cannot be dumped.

Approved means the user document `status` is exactly `approved`. A missing or unknown status is pending. An admin or super admin whose status is missing is not staff.

Legacy profiles that already have a role plus a name, email, or provider, and no status, can be marked approved with `npm run backfill:user-status` while signed in as the approved super admin. The script skips that super admin's own document, documents with no role, and role-only `setUserRole` documents that have not been reviewed. See [`scripts/backfillUserStatus.js`](./scripts/backfillUserStatus.js).

## Indexes

Test Results queries `fitTests` by `userId` and `createdAt`. If Firebase shows a missing-index error, use the link in the message or create:

- Collection: `fitTests`
- `userId` ascending
- `createdAt` descending
