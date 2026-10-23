# School list management and admin school assignment

This is a spec only. It describes a later change. It does not change the app, the rules, or any Firebase data.

Grounding is the code on `staging` after the tester-school merge (`7b26154`). The only school name compiled into the app today is `Helene College of Nursing`, the single entry in `SCHOOLS_OPTIONS` in `src/constants/fitTestOptions.js`. Test locations such as Harlem and Brooklyn are `testLocation` values, not schools. Per-user saved form presets in `users/{uid}/schoolProfiles` (`schoolName`) are also not this list.

## 1. Superadmin owns the master school list

Today the master list is the hardcoded `SCHOOLS_OPTIONS` array. Two callers use it:

- The fit-test form (`src/hooks/useFitTestForm.js` and `src/constants/initialFitTestForm.js`) uses it as the base "School / Client" choices and defaults `schoolsList` to the first value.
- The Manage Users create form uses it only when a super admin adds a tester (`UsersManagement.js`). A scoped admin does not see this constant. They see the names already stored on their own user document.

Proposal: replace that constant with a Firestore collection the super admin maintains in the app. Spark plan can do this with the client SDK and security rules. No Cloud Functions and no Blaze-only product.

Collection: `schools/{schoolId}`

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | The exact school string stored on user documents, for example `Helene College of Nursing` |
| `createdAt` | timestamp | When the super admin added it |
| `updatedAt` | timestamp | When the super admin last edited it |

`schoolId` is an auto-generated id, not the school name. A rename is then an update of `name` and does not require delete-and-recreate. User documents keep storing the name string, not `schoolId`, so documents already edited in the Firebase console stay readable without a migration. See section 6 and the open questions before anyone stores an id on a user instead.

Rules, same style as the existing `isSuperAdmin()` helper in `firestore.rules`:

- `read`: any signed-in user whose user document `status` is `approved`. Testers need the names if the fit-test form stops using `SCHOOLS_OPTIONS`. Admins need them for the create and edit controls below.
- `create`, `update`, `delete`: `isSuperAdmin()` only.
- `list` is allowed for that same approved read. This collection is not a public lookup. Guests stay denied.

The first document should be created by the super admin in the new UI, with `name` equal to `Helene College of Nursing`, so the live list matches today's constant. Do not seed production from this spec.

UI home: a super-admin-only "Schools" section on Manage Users, next to the user roster. It lists each `name` and offers add, edit, and remove. It is not the Edit Account "saved schools" panel, and it is not `users/{uid}/schoolProfiles`.

## 2. Only a super admin can add, edit, or remove schools

Rules are the boundary. An approved admin or tester who can read `schools` still fails `create`, `update`, and `delete`. An owner cannot write the collection by being signed in. A missing or non-approved status fails the read as well, using the same `approved` check as `isApproved()` today.

UI: render the add, edit, and remove controls only when `isSuperAdmin(user.role)` is true, the same helper Manage Users already uses for school-tag editing. A scoped admin and a tester never see those controls. Hiding the buttons is not the security check. The rules above still apply if the client is bypassed.

This does not change who may edit a user's `school` or `schools` fields. That stays the current `schoolTagsOkOnCreate` / `schoolTagsOkOnUpdate` behavior: only a super admin may change tags after create, and not on their own user document. A scoped admin still may not retag anyone.

## 3. When a super admin creates an admin, they multi-select that admin's schools

Today a super admin may create an admin (`rolesCreatableBy` returns `tester` and `admin`). The Add User form does not ask for schools when the role is `admin`. Schools are applied later, on the user card, in a single text field labeled "Schools". The card joins and splits that field on commas (`schoolsText` / `parseSchoolListInput`) and `updateManagedUser` writes a `schools` array. Only a super admin who is not editing themselves can change it (`canEditSchoolTags`).

The new create flow: when the role select is `admin`, show a multi-select whose options are the `name` values from `schools`. At least one school is required before Create User is enabled. The save writes those selected names to `schools` on the new admin document. The create form no longer uses `SCHOOLS_OPTIONS` for this choice.

The existing card editor should use the same multi-select, still super-admin-only and still blocked on the super admin's own card. A comma-separated text box is the wrong control once a master list exists, because it can introduce a name that is not on the list.

What gets stored is the current admin field, not a new one. See section 6. Do not invent a second assignment field.

## 4. When an admin creates a tester, they pick one school from the admin's assigned schools

This already exists and should stay, with the option source made explicit.

`UsersManagement.js` `handleCreate` and `createManagedUserProfile`:

- A scoped admin with no `schools` cannot create a tester. The form shows "You have no schools assigned, so you cannot add a tester. Ask a super admin to assign a school." and the submit button stays disabled.
- A scoped admin with exactly one assigned school does not pick. That name is shown read-only and written to the new tester's `school`.
- A scoped admin with several assigned schools must pick one. The select options are `user.schools`, not `SCHOOLS_OPTIONS`. Save stays disabled until the pick is one of those names.
- A super admin adding a tester may leave `school` unset or pick one. Today that picker is `SCHOOLS_OPTIONS`. After this feature it is the master list `name` values, still optional.

Rules already enforce the non-super-admin half. `createdTesterSchoolOk` requires `school` to be a non-empty string, forbids `schools` on that create, and requires `school in actorSchools()`. `actorSchools()` is `schoolsOf` on the caller's user document (the `schools` array). Missing or out-of-scope school is denied. A super admin may omit `school`.

The picker must keep offering the admin's assigned names, not every name on the master list. An admin assigned only `Helene College of Nursing` must not be able to tag a tester with some other school that a super admin added to `schools`.

## 5. Scoped admins only see testers from their own schools

No change to this behavior. It already matches the requirement.

`firestore.rules` `allow list` on `users`: a scoped admin may list only when the query is constrained to `role == tester` and `resource.data.school in actorSchools()`. An unfiltered list, a school outside their array, and a `role == superadmin` query are denied. A super admin may list every user. `allow get` lets a scoped admin read a tester whose `school` is in their `schools`, or an admin whose `schools` array is a non-empty subset of theirs (`adminInScope`). They can always read their own user document.

`getAllUsers` and `getPendingUsers` send that filter. `listScopedTesters` chunks the `in` query at 30 values (`FIRESTORE_IN_LIMIT` in `firebaseDb.js`), because Firestore allows at most 30 values in one `in` filter. `filterUsersForActor` in `src/utils/schoolScope.js` applies the same scope in the UI: own profile, testers whose `school` is in the actor's `schools`, and admins whose `schools` sit inside that list.

`fitTests`, `fitTestLookups`, and `fitTestVerifications` are not filtered by school. Leave that as it is.

## 6. School names are one shared string, and admins already store several of them

The school name is one string, the same spelling everywhere it is used. The confirmed value in code is `Helene College of Nursing`. A tester document stores that string in `school`. Rules read it with `schoolOf`, which requires a string.

An admin document does not store that assignment as one string. It stores `schools`, a list of those same strings. `schoolsOf` requires a list. `actorSchools()`, the list rule's `school in` check, `adminInScope` (`hasOnly`), and `filterUsersForActor` all read that array. `normalizeSchoolList` trims strings and drops blanks.

Requirement 3 (multi-select while creating an admin) fits this array: each selected row is one name string, and the admin document receives `schools: ["Helene College of Nursing", ...]`. The name on a tester's `school` and the name inside an admin's `schools` are the same string. They are not a shared document id.

This spec does not change that shape. Replacing an admin's `schools` array with a single `school` string would break `actorSchools()`, the list rule, and `adminInScope`. That is an open question for Sam, not a silent model change. See open questions.

A super admin's own document is not given `school` or `schools` by the client. `schoolTagsOkOnCreate` and `schoolTagsOkOnUpdate` deny tag writes when `request.auth.uid == userId`.

## 7. Console edits stay valid; the app replaces them going forward

People already set `school` and `schools` in the Firebase console. Those stored strings remain the values rules and list queries compare. This feature does not rewrite them and does not require them to already exist in `schools`.

Going forward, the app is how a super admin adds a school name, assigns schools to an admin, and how an admin tags a tester. Console edits are not the normal path.

Impact of acting on the master list, if existing user documents are left untouched:

- Add: new name appears in the super-admin multi-select and in the super-admin tester picker. No user document changes.
- Edit / rename: updating `schools/{id}.name` does not update `users.school`, `users.schools`, or `fitTests.schoolsList`. Those fields would keep the old spelling, so a renamed school would no longer match `school in actorSchools()` until something rewrites the old strings. This spec does not do that rewrite.
- Remove: the name disappears from new pickers. Testers who already have that `school` string stay on their documents. A scoped admin who still has that string in `schools` still matches them. A super admin would have to edit the admin's `schools` array to take the name away.

Whether rename or remove should also update existing user and fit-test documents is an open question.

## Out of scope

- Publishing `firestore.rules` or writing the production project.
- School-scoping `fitTests`, `fitTestLookups`, or `fitTestVerifications`.
- The per-user `schoolProfiles` presets on Edit Account, and the fit-test form's "Other / Add new school" path, except where a later decision replaces `SCHOOLS_OPTIONS` as `baseOptions`.
- `scripts/backfill-schools.js` and the staging notes in `STAGING.md`. That script only writes `Helene College of Nursing` and is a separate tool.
- Admin access start and end dates.
- Changing test locations, booking links, or the super-admin role guards.
- Letting an admin edit the master list or edit another user's school tags after create.

## Rules and test plan

Rules emulator (`npm run test:rules`), on top of the current school-scope tests:

- A super admin can create, rename, and delete a `schools` document.
- An approved admin cannot create, update, or delete a `schools` document. An approved tester cannot either. An unauthenticated client cannot.
- An approved admin and an approved tester can read the collection. A user who is not approved cannot.
- Existing tests stay: a scoped admin creating a tester must set `school` to one of their `schools`; missing, empty, and out-of-scope values fail; an admin with `schools: []` fails; a super admin may omit `school`.
- Existing list tests stay: unfiltered list denied, school outside the admin's array denied, `school in` their own schools allowed, super admin unfiltered list allowed.

Jest:

- The Schools section renders add, edit, and remove only for a super admin. An admin render does not show them.
- Super-admin create with role `admin` shows a multi-select of master-list names, blocks save until at least one is selected, and sends `schools` as an array of those strings.
- Scoped-admin create still auto-tags the single assigned school, still requires a pick when there are several, and still blocks with the current no-schools message when `schools` is empty. Options are the admin's assigned names, not the full master list.
- A scoped admin's roster still shows only testers whose `school` is in that admin's `schools`.

No test may call production Firebase.

## Open questions

1. Data model for Sam. Requirement 3 stores several school names on a new admin. The code already does that with `schools: string[]` on admin documents and `school: string` on tester documents. Each entry is the same name string, such as `Helene College of Nursing`. This spec keeps that. Should admins instead store a single `school` string, the same field testers use? Saying yes means rewriting `actorSchools()`, the list rule, `adminInScope`, `filterUsersForActor`, and the user-card editor. This spec will not do that unless Sam says to.
2. Should rules reject a `school` or `schools` write whose name is not in the `schools` collection? Enforcing that would make console-era and not-yet-listed names fail. Leaving the check in the UI only keeps section 7 intact.
3. On rename, should a follow-up rewrite every `users.school`, `users.schools` entry, and `fitTests.schoolsList` that still has the old spelling, or should old documents keep the old string?
4. On remove, is the master-list document deleted, or only hidden from pickers? Either way, this spec does not cascade onto existing user documents.
5. Is replacing `SCHOOLS_OPTIONS` on the fit-test form part of the same change? Testers currently need those options, which is why approved testers are included in the proposed `schools` read rule. Saved `schoolProfiles` would still be separate.
6. Is 30 assigned schools per admin a product cap, or is chunking at `FIRESTORE_IN_LIMIT` enough? The `in` operator cannot take more than 30 values in one query. The client already chunks.
7. Are school names matched exactly, after trim, with case left as typed? `Helene College of Nursing` is the only production name in `SCHOOLS_OPTIONS` today. A second spelling would be a different school to the rules.
