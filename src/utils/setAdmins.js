// Hardcoded admin emails and uids have been removed.
// Set the super admin in the Firebase console:
//   Firestore → users → {Sam's uid} → role = superadmin

const DISABLED = 'Client role grants are disabled. Set role to superadmin in the Firebase console.';

const disabled = async () => {
  throw new Error(DISABLED);
};

export const setAdmins = disabled;
export const setQisamAdmin = disabled;
export const setSecurefitAdmin = disabled;
