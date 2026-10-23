# School list management and admin school assignment

This is a spec only. It describes a later change. It does not change the app, the rules, or any Firebase data.

Grounding is the code on `staging` after the tester-school merge (`7b26154`). The only school name compiled into the app today is `Helene College of Nursing`, the single entry in `SCHOOLS_OPTIONS` in `src/constants/fitTestOptions.js`. Test locations such as Harlem and Brooklyn are `testLocation` values, not schools. Per-user saved form presets in `users/{uid}/schoolProfiles` (`schoolName`) are also not this list.

Sam's decisions, now part of this spec:

1. Admin documents switch from the `schools` array to a single `school` string, the same field testers use. An admin cannot change their own `school`. Only a super admin assigns it.
2. Rules reject a school name that is not in the master `schools` collection. A typo cannot be written.
3. Renaming or removing a master-list school does not rewrite user documents or fit-test documents. They keep the old name.

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

A rename is create-the-new-id plus delete-the-old-id. It is not an in-place id change. Decision 3: that pair of writes does not update `users.school` or `fitTests.schoolsList`.

Rules, same style as the existing `isSuperAdmin()` helper in `firestore.rules`:

- `read` and `list`: any signed-in user whose user document `status` is `approved`. Testers need the names if the fit-test form stops using `SCHOOLS_OPTIONS`. Admins need them to display their assigned school.
- `create`, `update`, `delete`: `isSuperAdmin()` only.
- This collection is not a public lookup. Guests stay denied.

`name` must equal the document id on create and on update. A super admin cannot park a second spelling in the `name` field.

The first document should be created by the super admin in the new UI, with id and `name` equal to `Helene College of Nursing`, so the live list matches today's constant. Do not seed production from this spec.

UI home: a super-admin-only "Schools" section on Manage Users, next to the user roster. It lists each `name` and offers add, edit, and remove. It is not the Edit Account "saved schools" panel, and it is not `users/{uid}/schoolProfiles`.

## 2. Only a super admin can add, edit, or remove schools

Rules are the boundary. An approved admin or tester who can read `schools` still fails `create`, `update`, and `delete`. An owner cannot write the collection by being signed in. A missing or non-approved status fails the read as well, using the same `approved` check as `isApproved()` today.

UI: render the add, edit, and remove controls only when `isSuperAdmin(user.role)` is true, the same helper Manage Users already uses for school-tag editing. A scoped admin and a tester never see those controls. Hiding the buttons is not the security check.

Assigning a school on a user document is separate from editing the master list, and it is also super-admin-only.

- Only a super admin may set `school` on someone else's user document.
- An admin cannot change their own `school`. A self-update must leave `school` absent-or-present exactly as it already is, and must not write `schools`.
- A super admin cannot set `school` on their own user document. That matches today's `schoolTagsOkOnUpdate` / `schoolTagsOkOnCreate` check `request.auth.uid != userId`.
- A scoped admin still cannot retag a tester or another admin after create.
- The `schools` array is not a writable field once the migration in section 6 has removed it. Rules reject creates and updates that include `schools`.

Decision 2 applies to every write that sets or changes `school`: the string must be the id of an existing `schools` document. The UI pickers list only those ids. The rules still reject a typed value that is not one of them.

## 3. When a super admin creates an admin, they pick one school

Today a super admin may create an admin (`rolesCreatableBy` returns `tester` and `admin`). The Add User form does not ask for a school when the role is `admin`. Schools are applied later, on the user card, in a text field labeled "Schools". The card joins and splits that field on commas (`schoolsText` / `parseSchoolListInput`) and `updateManagedUser` writes a `schools` array. Only a super admin who is not editing themselves can change it (`canEditSchoolTags`).

> **Supersedes the earlier multi-select.** An earlier draft of this spec said the super admin multi-selects several schools and writes `schools: string[]`. Sam's decision 1 replaces that. The create and edit controls are a single school picker, and the stored field is `school` (one string). This note is for Sam to confirm that the single picker is the intended reading of decision 1.

The new create flow: when the role select is `admin`, show one required select whose options are the document ids in `schools`. Create User stays disabled until one name is chosen. The save writes that string to `school` on the new admin document and does not write `schools`. The create form no longer uses `SCHOOLS_OPTIONS`.

The user-card editor uses the same single select, still super-admin-only and still blocked on the super admin's own card and on an admin's own card. The comma-separated "Schools" text box goes away. A value that is not in the master list cannot be saved (decision 2).

## 4. When an admin creates a tester, the admin's one school is auto-assigned

An admin has one `school`. They do not pick among several.

`UsersManagement.js` `handleCreate` and `createManagedUserProfile` change as follows:

- A scoped admin with no `school` cannot create a tester. The form shows "You have no school assigned, so you cannot add a tester. Ask a super admin to assign a school." and the submit button stays disabled.
- A scoped admin with a `school` does not see a picker. That name is shown read-only and written to the new tester's `school`.
- The several-schools picker (`user.schools`, "Select a school") is removed. Decision 1 leaves nothing to pick.
- A super admin adding a tester may leave `school` unset or pick one name from the master list. Today that picker is `SCHOOLS_OPTIONS`. After this feature the options are `schools` document ids. A chosen name must exist there. Omitting `school` writes no school string, so decision 2 does not apply to that create.

Rules: a scoped admin create must set `school` to the creating admin's own `school` string, must not include `schools`, and that string must still be the id of a `schools` document. Missing, empty, or a different name is denied. A super admin may omit `school`. If a super admin sets `school`, it must exist in `schools`.

An admin assigned `Helene College of Nursing` cannot tag a tester with any other master-list name.

## 5. Scoped admins only see testers from their own school

Visibility stays school-scoped, with equality instead of the `schools` array.

Today `allow list` on `users` requires `role == tester` and `resource.data.school in actorSchools()`, and `actorSchools()` is the caller's `schools` array. `listScopedTesters` chunks that `in` filter at 30 (`FIRESTORE_IN_LIMIT` in `firebaseDb.js`). `adminInScope` requires the other admin's `schools` list to be a non-empty subset of the caller's array. `filterUsersForActor` mirrors that in the UI.

After decision 1:

- `allow list`: a scoped admin may list only when the query is `role == tester` and `resource.data.school ==` the caller's `school` string. An unfiltered list, a different school, and a `role == superadmin` query stay denied. A super admin may still list every user.
- `allow get`: a scoped admin may read a tester, or another admin, whose `school` equals their own `school`. They can always read their own user document.
- `getAllUsers` and `getPendingUsers` send `where('school', '==', adminSchool)` plus the tester role filter. One equality filter does not need the 30-value `in` chunks. `FIRESTORE_IN_LIMIT` and `listScopedTesters` chunking go away for this path.
- `filterUsersForActor` shows the actor's own profile, testers whose `school` equals the actor's `school`, and admins whose `school` equals that same string.

`fitTests`, `fitTestLookups`, and `fitTestVerifications` are not filtered by school. Leave that as it is. A fit test whose `schoolsList` holds a renamed or removed name stays readable (decision 3).

## 6. One school string on testers and on admins

The school name is one string, the same spelling on every user document. The confirmed value in code today is `Helene College of Nursing`.

Today only testers store that string in `school`. `schoolOf` requires a string. Admin documents store `schools`, a list of those strings. `schoolsOf`, `actorSchools()`, the list rule's `in` check, `adminInScope` (`hasOnly`), and `filterUsersForActor` all read that array. `normalizeSchoolList` trims strings and drops blanks.

Decision 1, resolved: admins use `school` too. The array is not kept beside it. There is no second assignment field.

Migration of existing admin documents, once, before the new rules are published:

- `schools` has exactly one non-empty string: copy it to `school`, then delete `schools`. If that string is not yet a `schools` document id, a super admin adds the master-list document first (decision 2). The migration does not invent a name.
- `schools` is missing or empty: do not invent `school`. That admin has no school until a super admin assigns one. They cannot create a tester and their tester list is empty.
- `schools` has more than one name: do not pick one in a script. List those admin uids and the array for a super admin, who sets a single `school` from the master list in the app. Remove `schools` only after `school` is set.
- Tester documents that already have `school` stay as they are. Do not copy anything into `schools`.
- Do not rewrite `fitTests.schoolsList` in this migration (decision 3).

After migration, rules reject any create or update that still includes `schools`.

A super admin's own document still has no `school`. Self-assignment stays denied.

Self-edit after the switch:

- An admin may update their own allowed profile fields only when `school` is unchanged.
- An admin cannot clear `school` or replace it, on themselves or on anyone else.
- A tester owner update already cannot change `school`. That stays.
- Only a super admin, acting on someone else's document, may set or change `school`, and only to a current master-list id.

## 7. Existing values stay; new writes must be on the master list

People already set `school` and `schools` in the Firebase console. Decision 3: renaming or removing a master-list school does not rewrite those user documents or fit-test documents. They keep the old name. The migration in section 6 is the only planned user-document rewrite, and it only moves an admin's array onto `school`. It does not follow a later rename.

Going forward, the app is how a super admin adds a school name and assigns one `school` to an admin or a tester. Console edits are not the normal path. After the rules are published, the console is subject to the same rules: a write that sets `school` to a name with no `schools/{name}` document is rejected (decision 2). A stored name that is already there is not deleted by that publish.

Impact of acting on the master list:

- Add: the new id appears in the super-admin picker. No user document changes.
- Rename: create `schools/{newName}` and delete `schools/{oldName}`. `users.school` and `fitTests.schoolsList` that still say `oldName` are left as written. They no longer equal a current admin `school` unless that admin's `school` is also still `oldName`. This spec does not update them.
- Remove: delete `schools/{name}`. User and fit-test documents that contain that name keep it. New writes of that name fail decision 2.

Decision 2 and decision 3 together:

- Reads stay allowed. `get` and the scoped `list` compare stored strings to each other. They do not require the stored name to still exist in `schools`. A tester, an admin, and a fit test holding a renamed or removed name remain readable. A scoped admin whose own `school` is still that old string still sees testers with that same string.
- Creates that include `school` are denied unless that exact string is a `schools` document id.
- Updates that change `school` from its current value are denied unless the new string is a `schools` document id. Clearing `school` on someone else's document is a super-admin action and is allowed only by omitting the field, not by writing a name that is not on the list.
- Updates that leave `school` unchanged are allowed even when that stored name is no longer in `schools`. Otherwise decision 3 would freeze the document: an admin could not change a tester's status, and a super admin could not edit the user's name, while the old school string sat on the doc. The unchanged-school check must run before the membership check, and a missing `school` on both sides counts as unchanged.
- The same split applies to `fitTests.schoolsList`. A read is allowed. An update that does not change `schoolsList` is allowed. An update or create that sets `schoolsList` to a name that is not a current `schools` id is denied. The fit-test form path "Other / Add new school" cannot save a name a super admin has not added.

## Out of scope

- Publishing `firestore.rules` or writing the production project. The migration in section 6 is specified here and implemented later.
- School-scoping which fit tests a user can see. Membership checks on `schoolsList` writes are in section 7. List filters on `fitTests` are not.
- The per-user `schoolProfiles` presets on Edit Account. Those remain saved form defaults, not the master list.
- `scripts/backfill-schools.js` and the staging notes in `STAGING.md`. That script only writes `Helene College of Nursing` onto testers. The admin array migration is a different script.
- Admin access start and end dates.
- Changing test locations, booking links, or the super-admin role guards.
- Letting an admin edit the master list, change their own `school`, or retag another user after create.

## Rules and test plan

Rules emulator (`npm run test:rules`). Replace the assertions that still assume an admin `schools` array and a 30-value `in` query. Do not leave those as the passing suite.

Master list:

- A super admin can create, rename (create new id, delete old id), and delete a `schools` document.
- An approved admin cannot create, update, or delete a `schools` document. An approved tester cannot either. An unauthenticated client cannot.
- An approved admin and an approved tester can read the collection. A user who is not approved cannot.
- A `schools` write whose `name` does not equal the document id is denied.

User `school`:

- A super admin can set `school` on another admin and on a tester only when `schools/{name}` exists.
- A super admin write of a name that is not in `schools` is denied. An empty string and a near-spelling of `Helene College of Nursing` are denied.
- A super admin cannot set `school` on their own user document.
- An admin cannot change their own `school`, and cannot change another user's `school`.
- An admin self-update that leaves `school` as it is, and does not include `schools`, succeeds.
- A create or update that includes `schools` is denied.
- A scoped admin creating a tester auto-writes their own `school` and succeeds when that name is still in the master list. Missing `school`, a different name, and a name that has been removed from `schools` are denied.
- A super admin may create a tester with no `school`. A super admin who sets `school` must use a current master-list id.

Reads after rename or remove (decisions 2 and 3):

- A user document and a fit test that still hold the old name can be read.
- An update that does not change `school` (or `schoolsList` on a fit test) succeeds while that old name remains on the document.
- An update that changes `school` or `schoolsList` to the old name, or to any name that is not a current `schools` id, is denied.

Scoped list:

- A query `role == tester` and `school ==` the caller's `school` succeeds.
- An unfiltered list, `school ==` some other string, and `role == superadmin` are denied.
- A `school in [...]` query is not the allowed shape anymore.
- A super admin unfiltered list succeeds.

Jest:

- The Schools section renders add, edit, and remove only for a super admin.
- Super-admin create with role `admin` shows one school select of master-list names, not a multi-select. Save stays disabled until one is selected. The payload sends `school` as that string and does not send `schools`.
- The user card edits an admin's school with that same single select. An admin's own card does not offer a school editor.
- Scoped-admin create shows the admin's `school` read-only, sends that string, and does not show a school select. No assigned school blocks create with the singular message. There is no several-schools picker.
- A scoped admin's roster shows testers whose `school` equals that admin's `school`, and hides testers with a different `school`. The client does not issue an `in` query or chunk school lists.

No test may call production Firebase.

## Open questions

1. **Resolved.** Admins switch from `schools: string[]` to a single `school` string, the same field testers use. An admin cannot change their own `school`. Only a super admin assigns it, and not on the super admin's own document. Section 6 states the migration. The single picker in section 3 supersedes the earlier multi-select; Sam should confirm that reading.
2. **Resolved.** Rules reject any school name that is not an id in the master `schools` collection. The UI is not the only check.
3. **Resolved.** Renaming or removing a school does not rewrite user documents or fit-test documents. They keep the old name. Reads of those documents stay allowed. An update that does not change the stored school name stays allowed. An update that changes it must use a name that is still in the master list. Section 7 is that rule.
4. On remove, the master-list document is deleted (section 7). Hiding it and keeping the document is not required, because decision 3 already keeps the old string on user and fit-test documents. No open choice unless Sam would rather hide the row than delete it.
5. Is replacing `SCHOOLS_OPTIONS` on the fit-test form part of the same change? Testers currently need those options, which is why approved testers are included in the `schools` read rule. Decision 2 means "Other / Add new school" cannot persist a name the super admin has not added. Saved `schoolProfiles` stay separate either way.
6. **Resolved.** The 30-value `in` cap does not apply. An admin has one `school`, and the list query is `school ==` that string. Chunking in `listScopedTesters` is removed for this path.
7. **Resolved.** A written school name must equal a `schools` document id exactly, after trim. Comparison is the string Firestore stores, so `Helene College of Nursing` and any other spelling are different schools. Decision 2 is what rejects the typo.
