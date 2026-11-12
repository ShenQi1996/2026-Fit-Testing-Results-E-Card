/** Optional respiratory-program contact stored on a school and on a user. */

export const emptyProgramAdmin = () => ({
  programAdministratorName: '',
  programAdministratorContact: '',
});

const trimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

export const readProgramAdmin = (data) => ({
  programAdministratorName: trimmedString(data?.programAdministratorName),
  programAdministratorContact: trimmedString(data?.programAdministratorContact),
});

/**
 * School values win per field. A blank school field uses the user's value.
 * Both may be empty.
 * @param {object|null|undefined} schoolRecord
 * @param {object|null|undefined} user
 */
export const programAdminForSchool = (schoolRecord, user) => {
  const school = readProgramAdmin(schoolRecord);
  const profile = readProgramAdmin(user);
  return {
    programAdministratorName: school.programAdministratorName || profile.programAdministratorName,
    programAdministratorContact: school.programAdministratorContact || profile.programAdministratorContact,
  };
};
