import { assertStagingRecipient } from './emailService';

test('staging email refuses every recipient that is not example.com', () => {
  expect(() => assertStagingRecipient('person@example.com', 'staging')).not.toThrow();
  expect(() => assertStagingRecipient(' Person@Example.com ', 'staging')).not.toThrow();
  expect(() => assertStagingRecipient('customer@securefit.example', 'staging')).toThrow(
    /Staging does not email real customers/
  );
  expect(() => assertStagingRecipient('securefit2024+test_tester@gmail.com', 'staging')).toThrow(
    /@example.com/
  );
});

test('production email is not blocked by the staging recipient guard', () => {
  const saved = process.env.APP_ENV;
  delete process.env.APP_ENV;
  try {
    expect(() => assertStagingRecipient('customer@example.org')).not.toThrow();
    expect(() => assertStagingRecipient('customer@example.org', '')).not.toThrow();
    expect(() => assertStagingRecipient('customer@example.org', 'production')).not.toThrow();
  } finally {
    if (saved === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = saved;
  }
});
