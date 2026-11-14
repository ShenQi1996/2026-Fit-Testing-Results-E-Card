import {
  arrayRemove,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserAccessProfile } from './firebaseDb';
import { isSuperAdmin } from '../utils/roles';
import { readProgramAdmin } from '../utils/programAdmin';

const SCHOOLS_COLLECTION = 'schools';
const USERS_COLLECTION = 'users';
// Firestore caps a batched write at 500 operations.
export const SCHOOL_CASCADE_BATCH_LIMIT = 500;
const DIRECTORY_COLLECTION = 'schoolDirectory';
const DIRECTORY_ID = 'names';

let sessionRecords = null;

const sortedRecords = (records) => [...records]
  .filter((record) => typeof record?.name === 'string' && record.name.trim())
  .sort((a, b) => a.name.localeCompare(b.name));

const namesOf = (records) => records.map((record) => record.name);

const rememberRecords = (records) => {
  sessionRecords = sortedRecords(records);
  return [...sessionRecords];
};

/** Test helper. The app cache lives for the browser session. */
export const clearMasterSchoolsCache = () => {
  sessionRecords = null;
};

const permissionError = (message) => {
  const error = new Error(message);
  error.code = 'PERMISSION_DENIED';
  return error;
};

const assertSuperAdminWriter = async (userId) => {
  const access = await getUserAccessProfile(userId);
  if (access.status !== 'approved' || !isSuperAdmin(access.role)) {
    throw permissionError('Only a super admin can change the school list.');
  }
};

export const cleanSchoolName = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new Error('Enter a school name.');
  }
  if (trimmed.includes('/')) {
    throw new Error('A school name cannot contain "/".');
  }
  return trimmed;
};

const recordFromSnap = (docSnap) => ({
  name: docSnap.id,
  ...readProgramAdmin(typeof docSnap.data === 'function' ? docSnap.data() : null),
});

const recordsFromDirectory = (data) => {
  if (Array.isArray(data?.programs)) {
    return data.programs.map((entry) => ({
      name: typeof entry?.name === 'string' ? entry.name : '',
      ...readProgramAdmin(entry),
    }));
  }
  if (Array.isArray(data?.names)) {
    return data.names.map((name) => ({
      name,
      ...readProgramAdmin(null),
    }));
  }
  return null;
};

/**
 * School name plus the optional program administrator fields.
 * One directory document per session. The schools collection is read only
 * when that document has neither programs nor names.
 */
export const listMasterSchoolRecords = async () => {
  if (sessionRecords) return [...sessionRecords];

  const directorySnap = await getDoc(doc(db, DIRECTORY_COLLECTION, DIRECTORY_ID));
  const fromDirectory = directorySnap.exists()
    ? recordsFromDirectory(directorySnap.data())
    : null;
  if (fromDirectory) return rememberRecords(fromDirectory);

  const snapshot = await getDocs(collection(db, SCHOOLS_COLLECTION));
  const records = [];
  snapshot.forEach((docSnap) => {
    records.push(recordFromSnap(docSnap));
  });
  return rememberRecords(records);
};

export const listMasterSchools = async () => namesOf(await listMasterSchoolRecords());

/** One school. A missing document still returns the name with blank program fields. */
export const getMasterSchoolRecord = async (name) => {
  const schoolName = typeof name === 'string' ? name.trim() : '';
  if (!schoolName || schoolName.includes('/')) {
    return { name: schoolName, ...readProgramAdmin(null) };
  }
  const snap = await getDoc(doc(db, SCHOOLS_COLLECTION, schoolName));
  if (!snap.exists()) return { name: schoolName, ...readProgramAdmin(null) };
  return recordFromSnap(snap);
};

const writeDirectory = (batch, records) => {
  const sorted = sortedRecords(records);
  batch.set(doc(db, DIRECTORY_COLLECTION, DIRECTORY_ID), {
    names: namesOf(sorted),
    programs: sorted.map((record) => ({
      name: record.name,
      programAdministratorName: record.programAdministratorName || '',
      programAdministratorContact: record.programAdministratorContact || '',
    })),
    updatedAt: Timestamp.now(),
  });
};

export const addMasterSchool = async (userId, name, program) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchoolRecords();
  if (existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is already on the list.');
  }
  const fields = readProgramAdmin(program);
  const next = rememberRecords([...existing, { name: schoolName, ...fields }]);
  const batch = writeBatch(db);
  const now = Timestamp.now();
  batch.set(doc(db, SCHOOLS_COLLECTION, schoolName), {
    name: schoolName,
    ...fields,
    createdAt: now,
    updatedAt: now,
  });
  writeDirectory(batch, next);
  await batch.commit();
  return namesOf(next);
};

export const renameMasterSchool = async (userId, currentName, nextName, program) => {
  await assertSuperAdminWriter(userId);
  const from = cleanSchoolName(currentName);
  const to = cleanSchoolName(nextName);
  const existing = await listMasterSchoolRecords();
  const current = existing.find((record) => record.name === from);
  if (!current) {
    throw new Error('That school is not on the list.');
  }
  if (from === to) return namesOf(existing);
  if (existing.some((record) => record.name === to)) {
    throw new Error('That school is already on the list.');
  }
  const fields = program === undefined ? readProgramAdmin(current) : readProgramAdmin(program);
  const next = rememberRecords(existing.map((record) => (
    record.name === from ? { name: to, ...fields } : record
  )));
  const batch = writeBatch(db);
  const now = Timestamp.now();
  batch.set(doc(db, SCHOOLS_COLLECTION, to), {
    name: to,
    ...fields,
    createdAt: now,
    updatedAt: now,
  });
  batch.delete(doc(db, SCHOOLS_COLLECTION, from));
  writeDirectory(batch, next);
  await batch.commit();
  return namesOf(next);
};

export const updateMasterSchoolProgram = async (userId, name, program) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchoolRecords();
  if (!existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is not on the list.');
  }
  const fields = readProgramAdmin(program);
  const next = rememberRecords(existing.map((record) => (
    record.name === schoolName ? { name: schoolName, ...fields } : record
  )));
  const batch = writeBatch(db);
  batch.update(doc(db, SCHOOLS_COLLECTION, schoolName), {
    ...fields,
    updatedAt: Timestamp.now(),
  });
  writeDirectory(batch, next);
  await batch.commit();
  return namesOf(next);
};

const rawSchoolsOf = (data) => (
  Array.isArray(data?.schools) ? data.schools.filter((item) => typeof item === 'string') : []
);

const userSummary = (id, data) => ({
  id,
  name: typeof data?.name === 'string' ? data.name : '',
  email: typeof data?.email === 'string' ? data.email : '',
  role: typeof data?.role === 'string' ? data.role : 'tester',
  status: typeof data?.status === 'string' ? data.status : '',
});

/**
 * "Leave unset" in the user card school selector is the empty string: the
 * option is `<option value="">Leave unset</option>` and saving it writes
 * `school: ''`. Reads treat a missing `school` the same way.
 */
export const UNSET_SCHOOL = '';

const singleSchoolOf = (data) => (typeof data?.school === 'string' ? data.school.trim() : '');

/**
 * The update for one user after schools leave the master list.
 * - `schools`: every name not on the master list is dropped. firestore.rules
 *   only accept a changed list that is non-empty and fully listed, so stale
 *   names go together and an emptied list is deleted instead of written as [].
 *   Faculty never keep a `schools` list.
 * - `school`: a single school that is not on the master list is set to
 *   "Leave unset" (UNSET_SCHOOL). Faculty are skipped: rules require faculty to
 *   keep one non-empty school and the selector has no unset option for them.
 * Role and status are never part of the update. Returns null when nothing changes.
 */
export const planUserSchoolCleanup = (id, data, masterNames) => {
  const listed = new Set(masterNames);
  const isFaculty = data?.role === 'faculty';
  const current = rawSchoolsOf(data);
  const stale = current.filter((name) => !listed.has(name));
  const listChanges = isFaculty ? Array.isArray(data?.schools) : stale.length > 0;
  const single = singleSchoolOf(data);
  const singleStale = single !== '' && !listed.has(single);
  const clearSchool = singleStale && !isFaculty;
  if (!listChanges && !clearSchool) return null;
  const remaining = isFaculty ? [] : current.filter((name) => listed.has(name));
  return {
    ...userSummary(id, data),
    removed: listChanges ? (isFaculty ? current : stale) : [],
    listChanges,
    schools: listChanges ? remaining : current,
    clearSchool,
    school: clearSchool ? UNSET_SCHOOL : (typeof data?.school === 'string' ? data.school : ''),
    previousSchool: single,
    leftWithoutSchools: listChanges && !isFaculty && current.length > 0 && remaining.length === 0,
  };
};

const cleanupPayload = (plan) => {
  const payload = { updatedAt: Timestamp.now() };
  if (plan.listChanges) {
    payload.schools = plan.schools.length === 0 ? deleteField() : arrayRemove(...plan.removed);
  }
  if (plan.clearSchool) payload.school = UNSET_SCHOOL;
  return payload;
};

/** Faculty whose one school is off the master list. They are not changed. */
const facultyWithStaleSchool = (id, data, masterNames) => {
  if (data?.role !== 'faculty') return null;
  const single = singleSchoolOf(data);
  return single !== '' && !masterNames.includes(single) ? userSummary(id, data) : null;
};

const summarizePlans = (plans, facultyNeedingSchool = []) => ({
  users: plans,
  unsetUsers: plans.filter((plan) => plan.clearSchool),
  leftWithoutSchools: plans.filter((plan) => plan.leftWithoutSchools),
  facultyNeedingSchool,
});

/** Commits user cleanups in batches of 500, then `finalWrites` in the last batch. */
const commitUserCleanups = async (plans, finalWrites = null, finalWriteCount = 0) => {
  const chunks = [];
  for (let i = 0; i < plans.length; i += SCHOOL_CASCADE_BATCH_LIMIT) {
    chunks.push(plans.slice(i, i + SCHOOL_CASCADE_BATCH_LIMIT));
  }
  const last = chunks[chunks.length - 1];
  const finalFits = finalWrites
    && last
    && last.length + finalWriteCount <= SCHOOL_CASCADE_BATCH_LIMIT;
  for (let i = 0; i < chunks.length; i += 1) {
    const batch = writeBatch(db);
    chunks[i].forEach((plan) => {
      batch.update(doc(db, USERS_COLLECTION, plan.id), cleanupPayload(plan));
    });
    if (finalFits && i === chunks.length - 1) finalWrites(batch);
    await batch.commit();
  }
  if (finalWrites && !finalFits) {
    const batch = writeBatch(db);
    finalWrites(batch);
    await batch.commit();
  }
};

/** The master list straight from Firestore, not the session cache. */
const readFreshMasterRecords = async () => {
  sessionRecords = null;
  return listMasterSchoolRecords();
};

const usersWithSchool = async (schoolName) => {
  const [listSnap, singleSnap] = await Promise.all([
    getDocs(query(collection(db, USERS_COLLECTION), where('schools', 'array-contains', schoolName))),
    getDocs(query(collection(db, USERS_COLLECTION), where('school', '==', schoolName))),
  ]);
  const byId = new Map();
  listSnap.forEach((docSnap) => byId.set(docSnap.id, docSnap));
  singleSnap.forEach((docSnap) => byId.set(docSnap.id, docSnap));
  return [...byId.values()];
};

const planSchoolRemoval = async (userId, schoolName, existing) => {
  const nextNames = namesOf(existing.filter((record) => record.name !== schoolName));
  const docs = await usersWithSchool(schoolName);
  const plans = [];
  const facultyNeedingSchool = [];
  let skippedSelf = false;
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const plan = planUserSchoolCleanup(docSnap.id, data, nextNames);
    const faculty = facultyWithStaleSchool(docSnap.id, data, nextNames);
    // Rules never let anyone change the school tags on their own document.
    if (docSnap.id === userId) {
      if (plan) skippedSelf = true;
      return;
    }
    if (faculty) facultyNeedingSchool.push(faculty);
    if (plan) plans.push(plan);
  });
  return {
    school: schoolName,
    ...summarizePlans(plans, facultyNeedingSchool),
    skippedSelf,
  };
};

/**
 * Who a school removal would touch, for the confirm dialog. Two queries:
 * users whose `schools` contains the name, and users whose single `school` is it.
 */
export const previewMasterSchoolRemoval = async (userId, name) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await readFreshMasterRecords();
  if (!existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is not on the list.');
  }
  return planSchoolRemoval(userId, schoolName, existing);
};

/**
 * Removes the school from the master list and from every user: it leaves
 * each `schools` list, and a single `school` that was this name is set to
 * "Leave unset". Fit tests keep the name because they are historical records.
 * Faculty keep their `school` (rules require one) and are returned for the
 * super admin to reassign. Role and status never change.
 */
export const removeMasterSchool = async (userId, name) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await readFreshMasterRecords();
  if (!existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is not on the list.');
  }
  const plan = await planSchoolRemoval(userId, schoolName, existing);
  const nextRecords = existing.filter((record) => record.name !== schoolName);
  await commitUserCleanups(plan.users, (batch) => {
    batch.delete(doc(db, SCHOOLS_COLLECTION, schoolName));
    writeDirectory(batch, nextRecords);
  }, 2);
  const next = rememberRecords(nextRecords);
  return { ...plan, names: namesOf(next) };
};

/**
 * Users (from a list the super admin already loaded) with a `schools` entry or
 * a single `school` that is no longer on the master list.
 */
export const findUsersWithRemovedSchools = (users, masterNames, actorId) => (
  (Array.isArray(users) ? users : [])
    .filter((item) => item?.id && item.id !== actorId)
    .map((item) => planUserSchoolCleanup(item.id, item, masterNames))
    .filter(Boolean)
    .filter((plan) => plan.removed.length > 0 || plan.clearSchool)
);

/** Drops names that are no longer on the master list from those users. */
export const removeStaleSchoolsFromUsers = async (userId, users) => {
  await assertSuperAdminWriter(userId);
  const existing = await readFreshMasterRecords();
  const names = namesOf(existing);
  const plans = findUsersWithRemovedSchools(users, names, userId);
  await commitUserCleanups(plans);
  const facultyNeedingSchool = (Array.isArray(users) ? users : [])
    .filter((item) => item?.id && item.id !== userId)
    .map((item) => facultyWithStaleSchool(item.id, item, names))
    .filter(Boolean);
  return summarizePlans(plans, facultyNeedingSchool);
};
