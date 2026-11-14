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
 * The update that drops every school name not on the master list from one
 * user's `schools`. firestore.rules only accepts a changed `schools` list
 * when it is non-empty and every name is listed, so stale names go together
 * and an emptied list is deleted instead of written as [].
 * Faculty keep one `school` string and never a `schools` list.
 * Returns null when nothing needs to change.
 */
export const planUserSchoolCleanup = (id, data, masterNames) => {
  const listed = new Set(masterNames);
  const current = rawSchoolsOf(data);
  const stale = current.filter((name) => !listed.has(name));
  const isFaculty = data?.role === 'faculty';
  if (!isFaculty && stale.length === 0) return null;
  if (isFaculty && !Array.isArray(data?.schools)) return null;
  const remaining = isFaculty ? [] : current.filter((name) => listed.has(name));
  return {
    ...userSummary(id, data),
    removed: isFaculty ? current : stale,
    schools: remaining,
    leftWithoutSchools: !isFaculty && remaining.length === 0,
  };
};

const cleanupPayload = (plan) => ({
  schools: plan.schools.length === 0 ? deleteField() : arrayRemove(...plan.removed),
  updatedAt: Timestamp.now(),
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
  const listDocs = [];
  listSnap.forEach((docSnap) => listDocs.push(docSnap));
  const singleUsers = [];
  singleSnap.forEach((docSnap) => singleUsers.push(userSummary(docSnap.id, docSnap.data())));
  return { listDocs, singleUsers };
};

const planSchoolRemoval = async (userId, schoolName, existing) => {
  const nextNames = namesOf(existing.filter((record) => record.name !== schoolName));
  const { listDocs, singleUsers } = await usersWithSchool(schoolName);
  const plans = [];
  let skippedSelf = false;
  listDocs.forEach((docSnap) => {
    const plan = planUserSchoolCleanup(docSnap.id, docSnap.data(), nextNames);
    if (!plan) return;
    // Rules never let anyone change the school tags on their own document.
    if (docSnap.id === userId) {
      skippedSelf = true;
      return;
    }
    plans.push(plan);
  });
  return {
    school: schoolName,
    users: plans,
    leftWithoutSchools: plans.filter((plan) => plan.leftWithoutSchools),
    singleSchoolUsers: singleUsers,
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
 * Removes the school from the master list and from every user's `schools`.
 * Fit tests keep the name because they are historical records. A tester or
 * faculty `school` string is not changed: clearing it would block a tester from
 * saving fit tests and rules require faculty to keep one school, so those
 * users are returned for the super admin to reassign. Role and status never change.
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
 * Users (from a list the super admin already loaded) whose `schools` holds a
 * name that is no longer on the master list.
 */
export const findUsersWithRemovedSchools = (users, masterNames, actorId) => (
  (Array.isArray(users) ? users : [])
    .filter((item) => item?.id && item.id !== actorId)
    .map((item) => planUserSchoolCleanup(item.id, item, masterNames))
    .filter(Boolean)
    .filter((plan) => plan.removed.length > 0)
);

/** Drops names that are no longer on the master list from those users. */
export const removeStaleSchoolsFromUsers = async (userId, users) => {
  await assertSuperAdminWriter(userId);
  const existing = await readFreshMasterRecords();
  const plans = findUsersWithRemovedSchools(users, namesOf(existing), userId);
  await commitUserCleanups(plans);
  return {
    users: plans,
    leftWithoutSchools: plans.filter((plan) => plan.leftWithoutSchools),
  };
};
