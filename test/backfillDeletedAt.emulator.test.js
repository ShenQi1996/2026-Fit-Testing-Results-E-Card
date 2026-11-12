const admin = require('firebase-admin');
const { applyDeletedAtStamps } = require('../scripts/backfillDeletedAt');

const PROJECT_ID = 'demo-fit-test-rules';
const APP_NAME = 'backfill-deleted-at-emulator-test';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  throw new Error(
    'Refusing to run the deletedAt backfill emulator test without FIRESTORE_EMULATOR_HOST.'
  );
}

let app;

beforeAll(() => {
  app = admin.apps.find((entry) => entry && entry.name === APP_NAME)
    || admin.initializeApp({ projectId: PROJECT_ID }, APP_NAME);
});

afterAll(async () => {
  if (app) await app.delete();
});

const fitTest = (id) => app.firestore().collection('fitTests').doc(id);

const remove = async (...ids) => {
  await Promise.all(ids.map((id) => fitTest(id).delete()));
};

test('a concurrent soft delete is not overwritten, and the next batch still runs', async () => {
  const raced = 'backfill-emu-raced';
  const kept = 'backfill-emu-kept';
  const later = 'backfill-emu-later';
  await remove(raced, kept, later);
  await fitTest(raced).set({ creatorSchool: 'Helene College of Nursing', clientName: 'Raced' });
  await fitTest(kept).set({ creatorSchool: 'Helene College of Nursing', clientName: 'Kept' });
  await fitTest(later).set({ creatorSchool: 'Helene College of Nursing', clientName: 'Later' });

  const deletedAt = new Date('2026-10-25T12:00:00.000Z');
  const result = await applyDeletedAtStamps(app.firestore(), [raced, kept, later], {
    batchSize: 2,
    beforeCommit: async (snaps) => {
      if (snaps.some((snap) => snap.id === raced)) {
        await fitTest(raced).update({
          deletedAt,
          deletedBy: 'admin-1',
          deleteReason: 'Removed while the backfill was reading',
        });
      }
    },
  });

  expect(result.preconditionFailures).toBeGreaterThan(0);
  expect(result.skipped).toContain(raced);
  expect(result.written).toEqual(expect.arrayContaining([kept, later]));
  expect(result.failed).toEqual([]);

  const racedDoc = await fitTest(raced).get();
  expect(racedDoc.data().deletedBy).toBe('admin-1');
  expect(racedDoc.data().deletedAt).not.toBeNull();
  expect(racedDoc.data().deleteReason).toBe('Removed while the backfill was reading');

  const keptDoc = await fitTest(kept).get();
  expect(keptDoc.data().deletedAt).toBeNull();
  expect(keptDoc.data().clientName).toBe('Kept');

  const laterDoc = await fitTest(later).get();
  expect(laterDoc.data().deletedAt).toBeNull();

  const again = await applyDeletedAtStamps(app.firestore(), [raced, kept, later]);
  expect(again.written).toEqual([]);
  expect(again.skipped).toEqual(expect.arrayContaining([raced, kept, later]));
  const racedAgain = await fitTest(raced).get();
  expect(racedAgain.data().deletedBy).toBe('admin-1');

  await remove(raced, kept, later);
});
