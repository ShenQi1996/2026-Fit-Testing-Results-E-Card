import { doc, getDoc } from 'firebase/firestore';
import { lookupFitTestForVerification } from '../services/firebaseDb';

const token = 'abcdef0123456789abcdef0123456789';

const foundCard = (data) => ({
  exists: () => true,
  data: () => data,
  id: token,
});

describe('e-card verification status', () => {
  beforeEach(() => {
    getDoc.mockReset();
    doc.mockClear();
  });

  test('rejects a malformed token without reading Firebase', async () => {
    const result = await lookupFitTestForVerification('not-a-token');

    expect(result).toEqual({ status: 'invalid', card: null });
    expect(getDoc).not.toHaveBeenCalled();
  });

  test('returns invalid when the token is well formed but no card exists', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => null, id: token });

    const result = await lookupFitTestForVerification(token);

    expect(result).toEqual({ status: 'invalid', card: null });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'fitTestVerifications', token);
  });

  test('returns valid for a passing card that has not expired', async () => {
    getDoc.mockResolvedValue(foundCard({
      clientName: 'Jane Smith',
      result: ' Pass ',
      expirationDate: '01/01/2099',
    }));

    const result = await lookupFitTestForVerification(token.toUpperCase());

    expect(result.status).toBe('valid');
    expect(result.card.clientName).toBe('Jane Smith');
    expect(result.card.result).toBe(' Pass ');
  });

  test('returns expired, failed, and prefers expired over a failed result', async () => {
    getDoc.mockResolvedValueOnce(foundCard({
      result: 'Pass',
      expirationDate: '01/01/2000',
    }));
    await expect(lookupFitTestForVerification(token)).resolves.toMatchObject({ status: 'expired' });

    getDoc.mockResolvedValueOnce(foundCard({
      result: 'Fail',
      expirationDate: '01/01/2099',
    }));
    await expect(lookupFitTestForVerification(token)).resolves.toMatchObject({ status: 'failed' });

    getDoc.mockResolvedValueOnce(foundCard({
      result: 'Fail',
      expirationDate: '01/01/2000',
    }));
    await expect(lookupFitTestForVerification(token)).resolves.toMatchObject({ status: 'expired' });
  });
});
