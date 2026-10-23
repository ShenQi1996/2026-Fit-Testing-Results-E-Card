// Super admin is a role on the users/{uid} document, not an email checked in the client.
//
// One-off manual step, before deploying rules that require role == 'superadmin':
//   Firebase Console → Firestore → users → {Sam's uid}
//   Set field role (string) to superadmin
//
// Do not grant that role from the client. These exports fail closed so older
// console snippets cannot promote an account.

const DISABLED = 'Client role grants are disabled. Set role to superadmin in the Firebase console.';

const disabled = async () => {
  throw new Error(DISABLED);
};

export const setAdminUser = disabled;
export const setTesterUser = disabled;
export const setCurrentUserAsAdminIfEmail = disabled;
export const initializeAdminForQisam = disabled;
