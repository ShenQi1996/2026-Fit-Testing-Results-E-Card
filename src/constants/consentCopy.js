export const LEGAL_HUB_URL = 'https://next-leap-fit.vercel.app/legal';

export const PUBLIC_POLICIES = [
  { slug: 'service', label: 'Service' },
  { slug: 'booking', label: 'Booking' },
  { slug: 'terms', label: 'Terms' },
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'cookies', label: 'Cookies' },
  { slug: 'records', label: 'Records' },
  { slug: 'onsite', label: 'On-site' },
  { slug: 'communications', label: 'Email' },
  { slug: 'accessibility', label: 'Accessibility' },
  { slug: 'reviews', label: 'Reviews' },
];

export const PARTICIPANT_CONSENT_ITEMS = [
  {
    key: 'studentClearanceConfirmed',
    title: 'Medical restrictions',
    required: true,
    text: 'I have provided any medical restrictions, if any. Medical clearance for respirator use is handled by my employer or school. Signing this form does not itself establish medical clearance.',
  },
  {
    key: 'consentToFitTest',
    title: 'Fit-testing participation',
    required: true,
    text: 'This test evaluates the fit of the listed respirator. It is not a medical exam, an OSHA-issued certification, or a guarantee for every workplace hazard. I know what the test involves, can pause or stop, and will tell the technician about discomfort, breathing difficulty, detection of the agent, or another concern. Payment does not guarantee a pass. I consent to this test and to documenting the actual result.',
  },
  {
    key: 'privacyPolicyAcknowledged',
    title: 'Privacy Policy',
    required: true,
    text: 'I have been given access to the Privacy Policy. This is not consent to marketing, publicity, or unrestricted employer or school access.',
  },
  {
    key: 'recordDeliveryConfirmed',
    title: 'Record delivery',
    required: true,
    text: 'Send my fit-test record to the email on this form. Ordinary email may be visible to others with access to that account. This is not marketing or a release to someone else.',
  },
];

export const OPTIONAL_CONSENT_ITEMS = [
  {
    key: 'optionalOrganizationRelease',
    title: 'Release to employer or school',
    text: 'Send my fit-test record to the named employer or school for workplace or school reporting. Limited to identity, test date and method, respirator, result, and next routine test date. I can withdraw going forward at SecureFit2024@gmail.com.',
  },
  {
    key: 'optionalMarketingEmail',
    title: 'Email news and offers',
    text: 'I would like optional Secure Fit LLC news and offers by email. I can unsubscribe at any time. Not required to book or receive testing.',
  },
];

export const RECORD_DISCLAIMER =
  'This record documents the result for the listed respirator and date. It is not medical clearance or an OSHA-issued certification. Storage time does not extend the testing interval.';

export const TESTER_ATTESTATION_TEXT =
  "I attest that I witnessed the client's consent. I performed this qualitative respirator fit test in accordance with established procedures and followed the required test protocol. I confirm that sensitivity screening was completed when applicable and that the respirator manufacturer, model, style, and size recorded on this form match the respirator used during testing. I further attest that this record is complete, accurate, and created under my authenticated user account.";

export const TESTER_ATTESTATION_ITEMS = [
  { key: 'testerAttestationConsentWitnessed', title: 'Client consent witnessed' },
  { key: 'testerAttestationProtocolFollowed', title: 'Protocol followed' },
  { key: 'testerAttestationRespiratorMatchesRecord', title: 'Respirator matches record' },
];
