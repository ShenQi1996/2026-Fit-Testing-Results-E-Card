# School list management and admin school assignment

This is a spec only. It describes a later change. It does not change the app, the rules, or any Firebase data.

Grounding is the code on `staging` after the tester-school merge (`7b26154`). The only school name compiled into the app today is `Helene College of Nursing`, the single entry in `SCHOOLS_OPTIONS` in `src/constants/fitTestOptions.js`. Test locations such as Harlem and Brooklyn are `testLocation` values, not schools. Per-user saved form presets in `users/{uid}/schoolProfiles` (`schoolName`) are also not this list.

Implementation of this spec is in progress on this branch. Two later decisions sit on top of the sections below:

- Membership is checked with one `get` of `schoolDirectory/names` (`names` is a list of the `schools` document ids). The client updates that mirror in the same batch as each add, rename, or delete. `exists` on every name would exceed Firestore's 10-`get` limit, and scoped lists still chunk at 30.
- The fit-test form and Edit Account no longer use `SCHOOLS_OPTIONS` or per-user `schoolProfiles`. A tester sees only their `school`. An admin sees their `schools` array. A super admin sees the master list. The only add/edit/remove controls are the Schools section on Manage Users. Edit Account links there. Existing `schoolProfiles` documents are not deleted or migrated.

Sam's decisions, now part of this spec:

1. Admins keep a `schools` array (several schools per admin). Testers keep a single `school` string. An admin cannot change their own `schools`. Only a super admin assigns them.
2. Rules reject a school name that is not in the master `schools` collection, whether it is a tester's `school` or any element of an admin's `schools` array. A typo cannot be written.
3. Renaming or removing a master-list school does not rewrite user documents or fit-test documents. They keep the old name. An update that does not change `school` or `schools` is still allowed.

## 1. Superadmin owns the master school list

Today the master list is the hardcoded `SCHOOLS_OPTIONS` array. Two callers use it:

- The fit-test form (`src/hooks/useFitTestForm.js` and `src/constants/initialFitTestForm.js`) uses it as the base "School / Client" choices and defaults `schoolsList` to the first value.
- The Manage Users create form uses it only when a super admin adds a tester (`UsersManagement.js`). A scoped admin does not see this constant. They see the names already stored on their own user document.

Proposal: replace that constant with a Firestore collection the super admin maintains in the app. Spark plan can do this with the client SDK and security rules. No Cloud Functions and no Blaze-only product.

Collection: `schools/{schoolName}`

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | The same string as the document id, for example `Helene College of Nursing` |
| `createdAt` | timestamp | When the super admin added it |
| `updatedAt` | timestamp | When the super admin last edited it |

The document id is the school name. Firestore rules cannot query a collection, and decision 2 requires a rules check that the name exists. `exists(/databases/$(database)/documents/schools/$(name))` does that only when the id is the name. An auto-id would not.

A rename is create-the-new-id plus delete-the-old-id. It is not an in-place id change. Decision 3: that pair of writes does not update `users.school`, `users.schools`, or `fitTests.schoolsList`.

Rules, same style as the existing `isSuperAdmin()` helper in `firestore.rules`:

- `read` and `list`: any signed-in user whose user document `status` is `approved`. Testers need the names if the fit-test form stops using `SCHOOLS_OPTIONS`. Admins need them for the tester picker in section 4.
- `create`, `update`, `delete`: `isSuperAdmin()` only.
- This collection is not a public lookup. Guests stay denied.

`name` must equal the document id on create and on update. A super admin cannot park a second spelling in the `name` field.

The first document should be created by the super admin in the new UI, with id and `name` equal to `Helene College of Nursing`, so the live list matches today's constant. Do not seed production from this spec.

UI home: a super-admin-only "Schools" section on Manage Users, next to the user roster. It lists each `name` and offers add, edit, and remove. It is not the Edit Account "saved schools" panel, and it is not `users/{uid}/schoolProfiles`.

## 2. Only a super admin can add, edit, or remove schools

Rules are the boundary. An approved admin or tester who can read `schools` still fails `create`, `update`, and `delete` on the master collection. An owner cannot write that collection by being signed in. A missing or non-approved status fails the read as well, using the same `approved` check as `isApproved()` today.

UI: render the add, edit, and remove controls only when `isSuperAdmin(user.role)` is true, the same helper Manage Users already uses for school-tag editing. A scoped admin and a tester never see those controls. Hiding the buttons is not the security check.

Assigning schools on a user document is separate from editing the master list, and it is also super-admin-only.

- Only a super admin may set `school` on someone else's tester document, or `schools` on someone else's admin document.
- An admin cannot change their own `schools`. A self-update must leave that array unchanged and must not write `school` onto their own admin document.
- A super admin cannot set `school` or `schools` on their own user document. That matches today's `schoolTagsOkOnUpdate` / `schoolTagsOkOnCreate` check `request.auth.uid != userId`.
- A scoped admin still cannot retag a tester or another admin after create.

Decision 2 applies when a write sets or changes a school name. A tester `school` string must be the id of an existing master-list document. Every element of an admin `schools` array must be the id of an existing master-list document. The UI offers only those ids. The rules still reject a typed value that is not one of them.

## 3. When a super admin creates an admin, they multi-select that admin's schools

Today a super admin may create an admin (`rolesCreatableBy` returns `tester` and `admin`). The Add User form does not ask for schools when the role is `admin`. Schools are applied later, on the user card, in a single text field labeled "Schools". The card joins and splits that field on commas (`schoolsText` / `parseSchoolListInput`) and `updateManagedUser` writes a `schools` array. Only a super admin who is not editing themselves can change it (`canEditSchoolTags`).

The new create flow: when the role select is `admin`, show a multi-select whose options are the document ids in the master `schools` collection. At least one school is required before Create User is enabled. The save writes those selected names to the admin document's `schools` array and does not write a tester `school` field. The create form no longer uses `SCHOOLS_OPTIONS` for this choice.

The user-card editor uses the same multi-select, still super-admin-only and still blocked on the super admin's own card and on an admin's own card. The comma-separated text box goes away, because it can introduce a name that is not on the master list. Every selected name must already be a master-list id (decision 2).

## 4. When an admin creates a tester, they pick one school from their own `schools` array

This matches the create form already in `UsersManagement.js`. Keep it, and take the options from the admin's `schools` array rather than from `SCHOOLS_OPTIONS`.

`handleCreate` and `createManagedUserProfile`:

- A scoped admin with no `schools` cannot create a tester. The form shows "You have no schools assigned, so you cannot add a tester. Ask a super admin to assign a school." and the submit button stays disabled.
- A scoped admin with exactly one name in `schools` does not pick. That name is shown read-only and written to the new tester's `school`.
- A scoped admin with several names must pick one. The select options are that admin's `schools` array. Save stays disabled until the pick is one of those names.
- A super admin adding a tester may leave `school` unset or pick one name from the master list. Today that picker is `SCHOOLS_OPTIONS`. After this feature the options are master-list ids. A chosen name must exist there. Omitting `school` writes no school string, so decision 2 does not apply to that create.

Rules already require a scoped admin's tester create to set `school` to a non-empty string that is `in actorSchools()`, and to omit `schools` on that tester document (`createdTesterSchoolOk`). `actorSchools()` stays `schoolsOf` on the caller's user document. Add decision 2: that `school` string must also be a current master-list id. Missing, empty, or a name outside the admin's array is denied. A name inside the array but no longer on the master list is also denied. A super admin may omit `school`. If a super admin sets `school`, it must exist on the master list.

An admin whose `schools` are only `Helene College of Nursing` cannot tag a tester with any other master-list name.

## 5. Scoped admins only see testers from their own schools

No change to this behavior. It already matches the requirement.

`firestore.rules` `allow list` on `users`: a scoped admin may list only when the query is constrained to `role == tester` and `resource.data.school in actorSchools()`. An unfiltered list, a school outside their array, and a `role == superadmin` query are denied. A super admin may list every user. `allow get` lets a scoped admin read a tester whose `school` is in their `schools`, or an admin whose `schools` array is a non-empty subset of theirs (`adminInScope`). They can always read their own user document.

`getAllUsers` and `getPendingUsers` send that filter. `listScopedTesters` chunks the `in` query at 30 values (`FIRESTORE_IN_LIMIT` in `firebaseDb.js`), because Firestore allows at most 30 values in one `in` filter. Keep that chunking. `filterUsersForActor` in `src/utils/schoolScope.js` applies the same scope in the UI: own profile, testers whose `school` is in the actor's `schools`, and admins whose `schools` sit inside that list.

`fitTests`, `fitTestLookups`, and `fitTestVerifications` are not filtered by school. Leave that as it is. A fit test whose `schoolsList` holds a renamed or removed name stays readable (decision 3).

## 6. Testers store one string; admins keep the `schools` array

The school name is one string, the same spelling everywhere it is used. The confirmed value in code is `Helene College of Nursing`.

A tester document stores that string in `school`. `schoolOf` requires a string. An admin document stores several of those strings in `schools`. `schoolsOf` requires a list. `actorSchools()`, the list rule's `school in` check, `adminInScope` (`hasOnly`), and `filterUsersForActor` all read that array. `normalizeSchoolList` trims strings and drops blanks.

Decision 1, resolved: keep this split. Do not copy an admin's `schools` array onto a single `school` field, and do not delete the array. There is no migration of admin documents from `schools` to `school`.

Each element of `schools` is the same kind of name a tester stores in `school`. They are not document references. The master-list id is that same string, so membership is `exists` on `schools/{name}` for the tester field and for every array element.

A super admin's own document is not given `school` or `schools` by the client. `schoolTagsOkOnCreate` and `schoolTagsOkOnUpdate` deny those writes when `request.auth.uid == userId`.

Self-edit:

- An admin may update their own allowed profile fields only when `schools` is unchanged.
- An admin cannot clear or replace their own `schools`, and cannot change anyone else's `school` or `schools`.
- A tester owner update already cannot change `school`. That stays.
- Only a super admin, acting on someone else's document, may set or change `school` or `schools`. Every name in that write must be a current master-list id.

## 7. Existing values stay; new writes must be on the master list

People already set `school` and `schools` in the Firebase console. Those stored strings remain on the documents. Decision 3: renaming or removing a master-list school does not rewrite user documents or fit-test documents. They keep the old name. This spec does not migrate admin arrays and does not follow a rename with a rewrite.

Going forward, the app is how a super admin adds a school name, assigns an admin's `schools`, and how an admin tags a tester. Console edits are not the normal path. After the rules are published, the console is subject to the same rules. A write that sets a tester `school`, or any admin `schools` element, to a name with no master-list document is rejected (decision 2). A name already stored is not deleted by that publish.

Impact of acting on the master list:

- Add: the new id appears in the super-admin multi-select and in the super-admin tester picker. No user document changes.
- Rename: create `schools/{newName}` and delete `schools/{oldName}`. `users.school`, `users.schools`, and `fitTests.schoolsList` that still contain `oldName` are left as written. A tester with that old `school` still matches an admin who still has `oldName` in `schools`, because the list rule compares those stored strings. This spec does not update them.
- Remove: delete `schools/{name}`. User and fit-test documents that contain that name keep it. New writes of that name fail decision 2.

Decision 2 and decision 3 together:

- Reads stay allowed. `get` and the scoped `list` compare stored strings. They do not require the stored name to still exist on the master list. A tester, an admin, and a fit test holding a renamed or removed name remain readable. A scoped admin who still has that old string in `schools` still sees testers whose `school` is that string.
- Creates that include a tester `school`, or an admin `schools` array, are denied unless every written name is a current master-list id.
- Updates that change `school` or `schools` from the current value are denied unless every name in the new value is a current master-list id.
- Updates that leave `school` and `schools` unchanged are allowed even when a stored name is no longer on the master list. Otherwise decision 3 would freeze the document: an admin could not change a tester's status, and a super admin could not edit the user's name, while the old school string sat on the doc. The unchanged check runs before the membership check. A missing field on both sides counts as unchanged. For `schools`, unchanged means the list has the same elements, not a reordered or edited list.
- The same split applies to `fitTests.schoolsList`. A read is allowed. An update that does not change `schoolsList` is allowed. An update or create that sets `schoolsList` to a name that is not a current master-list id is denied. The fit-test form path "Other / Add new school" cannot save a name a super admin has not added.

## Out of scope

- Publishing `firestore.rules` or writing the production project.
- School-scoping which fit tests a user can see. Membership checks on `schoolsList` writes are in section 7. List filters on `fitTests` are not.
- Deleting or migrating existing `users/{uid}/schoolProfiles` documents. The app stops reading and writing them. The rules for that subcollection stay so old documents are left in place.
- `scripts/backfill-schools.js` and the staging notes in `STAGING.md`. That script only writes `Helene College of Nursing` onto testers. It is a separate tool.
- Admin access start and end dates.
- Changing test locations, booking links, or the super-admin role guards.
- Replacing an admin's `schools` array with one `school` string.
- Letting an admin edit the master list, change their own `schools`, or retag another user after create.

## Rules and test plan

Rules emulator (`npm run test:rules`), on top of the current school-scope tests:

Master list:

- A super admin can create, rename (create new id, delete old id), and delete a master-list `schools` document.
- An approved admin cannot create, update, or delete a master-list document. An approved tester cannot either. An unauthenticated client cannot.
- An approved admin and an approved tester can read the collection. A user who is not approved cannot.
- A master-list write whose `name` does not equal the document id is denied.

User school fields:

- A super admin can set `schools` on another admin, and `school` on a tester, only when every name exists on the master list.
- A name that is not on the master list is denied on a tester `school` and on any element of an admin `schools` array. An empty string and a near-spelling of `Helene College of Nursing` are denied.
- A super admin cannot set `school` or `schools` on their own user document.
- An admin cannot change their own `schools`, and cannot change another user's `school` or `schools`.
- An admin self-update that leaves `schools` unchanged succeeds.
- A scoped admin with one assigned school creates a tester tagged with that school and succeeds when the name is still on the master list.
- A scoped admin with several schools succeeds only when the tester `school` is one of those names and still on the master list. Missing, empty, and out-of-array names fail.
- An admin with `schools: []` cannot create a tester.
- A name that is still in the admin's array but has been removed from the master list is denied on create.
- A super admin may create a tester with no `school`. A super admin who sets `school` must use a current master-list id.

Reads after rename or remove (decisions 2 and 3):

- A user document and a fit test that still hold the old name can be read.
- An update that does not change `school` or `schools` (or `schoolsList` on a fit test) succeeds while that old name remains on the document.
- An update that changes `school`, any element of `schools`, or `schoolsList` to a name that is not a current master-list id is denied.

Scoped list, unchanged from today:

- An unfiltered list is denied. A query for a school outside the admin's `schools` is denied. A `role == superadmin` query is denied.
- A query `role == tester` and `school in` the admin's own schools is allowed. More than 30 schools are queried in chunks of 30.
- A super admin unfiltered list is allowed.

Jest:

- The Schools section renders add, edit, and remove only for a super admin. An admin render does not show them.
- Super-admin create with role `admin` shows a multi-select of master-list names, blocks save until at least one is selected, and sends `schools` as an array of those strings.
- The user card edits an admin's `schools` with that same multi-select. An admin's own card does not offer a school editor.
- Scoped-admin create with one assigned school auto-tags that school and does not show a picker.
- Scoped-admin create with several schools shows a picker limited to that admin's `schools`, and blocks save until one is chosen.
- Scoped-admin create with no schools shows the current no-schools message and does not call create.
- A scoped admin's roster shows only testers whose `school` is in that admin's `schools`. The client still chunks `in` queries at 30.

No test may call production Firebase.

## Open questions

1. **Resolved.** Keep the admin `schools` array. Testers keep a single `school` string. There is no migration from the array to one field. A super admin multi-selects the array on create. An admin cannot change their own `schools`.
2. **Resolved.** Rules reject any school name that is not an id in the master `schools` collection, including a tester's `school` and every element of an admin's `schools`. The UI is not the only check.
3. **Resolved.** Renaming or removing a school does not rewrite user documents or fit-test documents. They keep the old name. Reads of those documents stay allowed. An update that does not change `school` or `schools` stays allowed. An update that changes either field must use names that are still on the master list. Section 7 is that rule.
4. On remove, the master-list document is deleted (section 7). Hiding it and keeping the document is not required, because decision 3 already keeps the old string on user and fit-test documents. No open choice unless Sam would rather hide the row than delete it.
5. **Resolved by the build.** The fit-test "School / client" dropdown follows the signed-in user: a tester is locked to their `school`, an admin chooses from their `schools` array (one name is pre-selected), and a super admin chooses from the master list. There is no free-text school field and no hardcoded `SCHOOLS_OPTIONS` on that form. `SCHOOLS_OPTIONS` remains only for the separate backfill script. Approved users can still read the master list. `schoolProfiles` are not the source.
6. **Resolved.** Keep the existing 30-value chunking. Scoped visibility stays `role == tester` and `school in` the admin's `schools`. `listScopedTesters` still splits a longer array into chunks of 30.
7. **Resolved.** A written school name must equal a master-list document id exactly, after trim. Comparison is the string Firestore stores, so `Helene College of Nursing` and any other spelling are different schools. Decision 2 is what rejects the typo.
