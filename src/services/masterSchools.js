import {
  collection,
  doc,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserAccessProfile } from './firebaseDb';
import { isSuperAdmin } from '../utils/roles';

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

export const listMasterSchools = async () => {
  const snapshot = await getDocs(collection(db, SCHOOLS_COLLECTION));
  const names = [];
  snapshot.forEach((docSnap) => {
    names.push(docSnap.id);
  });
  names.sort((a, b) => a.localeCompare(b));
  return names;
};

const writeDirectory = (batch, names) => {
  batch.set(doc(db, DIRECTORY_COLLECTION, DIRECTORY_ID), {
    names,
    updatedAt: Timestamp.now(),
  });
};

export const addMasterSchool = async (userId, name) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchools();
  if (existing.includes(schoolName)) {
    throw new Error('That school is already on the list.');
  }
  const names = [...existing, schoolName].sort((a, b) => a.localeCompare(b));
  const batch = writeBatch(db);
  const now = Timestamp.now();
  batch.set(doc(db, SCHOOLS_COLLECTION, schoolName), {
    name: schoolName,
    createdAt: now,
    updatedAt: now,
  });
  writeDirectory(batch, names);
  await batch.commit();
  return names;
};

export const renameMasterSchool = async (userId, currentName, nextName) => {
  await assertSuperAdminWriter(userId);
  const from = cleanSchoolName(currentName);
  const to = cleanSchoolName(nextName);
  const existing = await listMasterSchools();
  if (!existing.includes(from)) {
    throw new Error('That school is not on the list.');
  }
  if (from === to) return existing;
  if (existing.includes(to)) {
    throw new Error('That school is already on the list.');
  }
  const names = existing
    .map((school) => (school === from ? to : school))
    .sort((a, b) => a.localeCompare(b));
  const batch = writeBatch(db);
  const now = Timestamp.now();
  batch.set(doc(db, SCHOOLS_COLLECTION, to), {
    name: to,
    createdAt: now,
    updatedAt: now,
  });
  batch.delete(doc(db, SCHOOLS_COLLECTION, from));
  writeDirectory(batch, names);
  await batch.commit();
  return names;
};

export const removeMasterSchool = async (userId, name) => {
  await assertSuperAdminWriter(userId);
  const schoolName = cleanSchoolName(name);
  const existing = await listMasterSchools();
  if (!existing.includes(schoolName)) {
    throw new Error('That school is not on the list.');
  }
  const names = existing.filter((school) => school !== schoolName);
  const batch = writeBatch(db);
  batch.delete(doc(db, SCHOOLS_COLLECTION, schoolName));
  writeDirectory(batch, names);
  await batch.commit();
  return names;
};
