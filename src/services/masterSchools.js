import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserAccessProfile } from './firebaseDb';
import { isSuperAdmin } from '../utils/roles';
import { readProgramAdmin } from '../utils/programAdmin';

const SCHOOLS_COLLECTION = 'schools';
const DIRECTORY_COLLECTION = 'schoolDirectory';
const DIRECTORY_ID = 'names';

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
  ...readProgramAdmin(docSnap.data()),
});

const sortedRecords = (records) => [...records].sort((a, b) => a.name.localeCompare(b.name));

/** School name plus the optional program administrator fields stored on that school. */
export const listMasterSchoolRecords = async () => {
  const snapshot = await getDocs(collection(db, SCHOOLS_COLLECTION));
  const records = [];
  snapshot.forEach((docSnap) => {
    records.push(recordFromSnap(docSnap));
  });
  return sortedRecords(records);
};

export const listMasterSchools = async () => {
  const records = await listMasterSchoolRecords();
  return records.map((record) => record.name);
};

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
    names: sorted.map((record) => record.name),
    programs: sorted.map((record) => ({
      name: record.name,
      programAdministratorName: record.programAdministratorName || '',
      programAdministratorContact: record.programAdministratorContact || '',
    })),
    updatedAt: Timestamp.now(),
  });
};

const namesOf = (records) => sortedRecords(records).map((record) => record.name);

export const addMasterSchool = async (userId, name, program) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchoolRecords();
  if (existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is already on the list.');
  }
  const fields = readProgramAdmin(program);
  const next = sortedRecords([...existing, { name: schoolName, ...fields }]);
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
  const next = sortedRecords(existing.map((record) => (
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
  const next = existing.map((record) => (
    record.name === schoolName ? { name: schoolName, ...fields } : record
  ));
  const batch = writeBatch(db);
  batch.update(doc(db, SCHOOLS_COLLECTION, schoolName), {
    ...fields,
    updatedAt: Timestamp.now(),
  });
  writeDirectory(batch, next);
  await batch.commit();
  return namesOf(next);
};

export const removeMasterSchool = async (userId, name) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchoolRecords();
  if (!existing.some((record) => record.name === schoolName)) {
    throw new Error('That school is not on the list.');
  }
  const next = existing.filter((record) => record.name !== schoolName);
  const batch = writeBatch(db);
  batch.delete(doc(db, SCHOOLS_COLLECTION, schoolName));
  writeDirectory(batch, next);
  await batch.commit();
  return namesOf(next);
};
