import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizeSenderEmail } from '../utils/emailSendLimit';

export const EMAIL_SEND_LOG_COLLECTION = 'emailSendLog';

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getLastStaffSendAt = async (uid) => {
  const snap = await getDoc(doc(db, EMAIL_SEND_LOG_COLLECTION, uid));
  if (!snap.exists()) return null;
  return toDate(snap.data()?.lastSentAt);
};

export const recordStaffSend = async (uid, senderEmail) => {
  await setDoc(doc(db, EMAIL_SEND_LOG_COLLECTION, uid), {
    lastSentAt: Timestamp.now(),
    senderEmail: normalizeSenderEmail(senderEmail),
  });
};
