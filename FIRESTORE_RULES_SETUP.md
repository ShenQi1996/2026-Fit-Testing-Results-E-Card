# Firestore security rules

Public **verify** (`/verify/:token`) and **resend** (`/resend`) only work after these rules are published. If `/verify` says verification is not enabled, the live Firebase project is still on older rules.

## Publish

1. Open [Firebase Console](https://console.firebase.google.com/) → your project
2. **Firestore Database** → **Rules**
3. Paste the full contents of [`firestore.rules`](./firestore.rules) from this repo
4. Click **Publish**
5. Reload the app and test `/verify/:token` and `/resend`

Do not invent a shorter rule set. Older snippets in past docs omitted `fitTestVerifications` and `fitTestLookups`, which breaks the public pages.

## What the rules allow

| Collection | Read | Write |
|------------|------|--------|
| `users` | Owner or admin | Create pending testers; owner cannot change `role`/`status`; admin can |
| `solutionProfiles` / `schoolProfiles` | Approved owner | Approved owner |
| `fitTests` | Approved owner or admin | Approved owner or admin |
| `fitTestLookups/{lookupKey}` | Public **get** of one doc if the key is known | Approved staff create/update; owner or admin delete |
| `fitTestVerifications/{token}` | Public **get** of one doc if the token is known | Approved staff create/update; owner or admin delete |

`list` is denied on the public collections so they cannot be dumped.

Approved means the user document `status` is `approved`, or `status` is missing (older accounts).

## Indexes

Test Results queries `fitTests` by `userId` and `createdAt`. If Firebase shows a missing-index error, use the link in the message or create:

- Collection: `fitTests`
- `userId` ascending
- `createdAt` descending
