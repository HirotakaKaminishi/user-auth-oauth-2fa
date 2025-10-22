import { describe, it, expect, beforeAll } from '@jest/globals';
import { EncryptionService } from '../../services/encryption-service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const encryptionKey = 'test-key-32-chars-for-aes-256!'; // 32 bytes for AES-256

  beforeAll(() => {
    encryptionService = new EncryptionService(encryptionKey);
  });

  describe('TOTP Secret Encryption/Decryption (AES-256-GCM)', () => {
    it('should encrypt and decrypt TOTP secret successfully', () => {
      const secret = 'JBSWY3DPEHPK3PXP'; // Base32-encoded secret

      const encryptResult = encryptionService.encryptTOTPSecret(secret);
      expect(encryptResult.success).toBe(true);

      if (!encryptResult.success) return;

      const encrypted = encryptResult.value;
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(secret);

      const decryptResult = encryptionService.decryptTOTPSecret(encrypted);
      expect(decryptResult.success).toBe(true);

      if (!decryptResult.success) return;

      expect(decryptResult.value).toBe(secret);
    });

    it('should return error when decrypting invalid ciphertext', () => {
      const invalidCiphertext = 'invalid-ciphertext';

      const result = encryptionService.decryptTOTPSecret(invalidCiphertext);
      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('DECRYPTION_FAILED');
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const secret = 'JBSWY3DPEHPK3PXP';

      const result1 = encryptionService.encryptTOTPSecret(secret);
      const result2 = encryptionService.encryptTOTPSecret(secret);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (!result1.success || !result2.success) return;

      // Different ciphertexts due to random IV
      expect(result1.value).not.toBe(result2.value);

      // But both decrypt to same plaintext
      const decrypt1 = encryptionService.decryptTOTPSecret(result1.value);
      const decrypt2 = encryptionService.decryptTOTPSecret(result2.value);

      expect(decrypt1.success).toBe(true);
      expect(decrypt2.success).toBe(true);

      if (!decrypt1.success || !decrypt2.success) return;

      expect(decrypt1.value).toBe(secret);
      expect(decrypt2.value).toBe(secret);
    });
  });

  describe('Recovery Code Hashing/Verification (bcrypt strength 14)', () => {
    it('should hash and verify recovery code successfully', async () => {
      const recoveryCode = 'ABC123DEF456';

      const hashResult = await encryptionService.hashRecoveryCode(recoveryCode);
      expect(hashResult.success).toBe(true);

      if (!hashResult.success) return;

      const hash = hashResult.value;
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(recoveryCode);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format

      const verifyResult = await encryptionService.verifyRecoveryCode(recoveryCode, hash);
      expect(verifyResult.success).toBe(true);

      if (!verifyResult.success) return;

      expect(verifyResult.value).toBe(true);
    });

    it('should return false for incorrect recovery code', async () => {
      const correctCode = 'ABC123DEF456';
      const incorrectCode = 'WRONG123CODE';

      const hashResult = await encryptionService.hashRecoveryCode(correctCode);
      expect(hashResult.success).toBe(true);

      if (!hashResult.success) return;

      const verifyResult = await encryptionService.verifyRecoveryCode(incorrectCode, hashResult.value);
      expect(verifyResult.success).toBe(true);

      if (!verifyResult.success) return;

      expect(verifyResult.value).toBe(false);
    });

    it('should produce different hashes for same recovery code (due to random salt)', async () => {
      const recoveryCode = 'ABC123DEF456';

      const hash1Result = await encryptionService.hashRecoveryCode(recoveryCode);
      const hash2Result = await encryptionService.hashRecoveryCode(recoveryCode);

      expect(hash1Result.success).toBe(true);
      expect(hash2Result.success).toBe(true);

      if (!hash1Result.success || !hash2Result.success) return;

      // Different hashes due to random salt
      expect(hash1Result.value).not.toBe(hash2Result.value);

      // But both verify correctly
      const verify1 = await encryptionService.verifyRecoveryCode(recoveryCode, hash1Result.value);
      const verify2 = await encryptionService.verifyRecoveryCode(recoveryCode, hash2Result.value);

      expect(verify1.success && verify1.value).toBe(true);
      expect(verify2.success && verify2.value).toBe(true);
    });
  });

  describe('Cryptographically Secure Random String Generation', () => {
    it('should generate random hex string of specified length', () => {
      const length = 32;
      const result = encryptionService.generateRandomHex(length);

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value).toHaveLength(length * 2); // hex = 2 chars per byte
      expect(result.value).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate different random strings', () => {
      const result1 = encryptionService.generateRandomHex(32);
      const result2 = encryptionService.generateRandomHex(32);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (!result1.success || !result2.success) return;

      expect(result1.value).not.toBe(result2.value);
    });

    it('should generate random base64 string', () => {
      const length = 32;
      const result = encryptionService.generateRandomBase64(length);

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value).toBeTruthy();
      expect(result.value).toMatch(/^[A-Za-z0-9+/]+=*$/); // base64 format
    });

    it('should generate alphanumeric recovery code (10 chars)', () => {
      const result = encryptionService.generateRecoveryCode();

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value).toHaveLength(10);
      expect(result.value).toMatch(/^[A-Z0-9]+$/); // uppercase alphanumeric
    });

    it('should generate 8 unique recovery codes', () => {
      const result = encryptionService.generateRecoveryCodes();

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value).toHaveLength(8);

      // All codes should be unique
      const uniqueCodes = new Set(result.value);
      expect(uniqueCodes.size).toBe(8);

      // All codes should be 10 chars alphanumeric
      result.value.forEach((code) => {
        expect(code).toHaveLength(10);
        expect(code).toMatch(/^[A-Z0-9]+$/);
      });
    });
  });

  describe('PKCE (Proof Key for Code Exchange)', () => {
    it('should generate code_verifier (43-128 chars URL-safe)', () => {
      const result = encryptionService.generateCodeVerifier();

      expect(result.success).toBe(true);

      if (!result.success) return;

      const verifier = result.value;
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe base64
    });

    it('should generate code_challenge from code_verifier (SHA256)', () => {
      const verifierResult = encryptionService.generateCodeVerifier();
      expect(verifierResult.success).toBe(true);

      if (!verifierResult.success) return;

      const verifier = verifierResult.value;
      const challengeResult = encryptionService.generateCodeChallenge(verifier);

      expect(challengeResult.success).toBe(true);

      if (!challengeResult.success) return;

      const challenge = challengeResult.value;
      expect(challenge).toBeTruthy();
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe base64
      expect(challenge).not.toBe(verifier);
    });

    it('should generate same code_challenge for same code_verifier', () => {
      const verifier = 'test-verifier-12345';

      const challenge1 = encryptionService.generateCodeChallenge(verifier);
      const challenge2 = encryptionService.generateCodeChallenge(verifier);

      expect(challenge1.success).toBe(true);
      expect(challenge2.success).toBe(true);

      if (!challenge1.success || !challenge2.success) return;

      expect(challenge1.value).toBe(challenge2.value);
    });

    it('should generate different code_challenges for different code_verifiers', () => {
      const verifier1 = 'test-verifier-1';
      const verifier2 = 'test-verifier-2';

      const challenge1 = encryptionService.generateCodeChallenge(verifier1);
      const challenge2 = encryptionService.generateCodeChallenge(verifier2);

      expect(challenge1.success).toBe(true);
      expect(challenge2.success).toBe(true);

      if (!challenge1.success || !challenge2.success) return;

      expect(challenge1.value).not.toBe(challenge2.value);
    });
  });
});
