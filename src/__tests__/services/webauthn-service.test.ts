/**
 * WebAuthn Service Tests
 * Task 5.5: WebAuthn (FIDO2) Authentication
 */

import { WebAuthnService } from '../../services/webauthn-service';
import { IWebAuthnCredentialRepository, WebAuthnCredential } from '../../types/webauthn';
import { Ok, Err, isOk, isErr } from '../../types/result';
import type { Redis as RedisClient } from 'ioredis';

// Mock @simplewebauthn/server
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let mockRepo: jest.Mocked<IWebAuthnCredentialRepository>;
  let mockRedis: jest.Mocked<RedisClient>;

  const mockUserId = 'user-123';
  const mockCredentialId = 'cred-456';
  const mockChallenge = 'test-challenge-base64url';
  const mockRpId = 'localhost';
  const mockRpName = 'Test App';
  const mockOrigin = 'http://localhost:3000';

  const mockCredential: WebAuthnCredential = {
    id: mockCredentialId,
    userId: mockUserId,
    credentialId: 'credential-id-base64url',
    publicKey: 'public-key-base64url',
    counter: 0,
    transports: ['internal'],
    deviceName: 'Test Device',
    aaguid: 'aaguid-hex',
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repository
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCredentialId: jest.fn(),
      findByUserId: jest.fn(),
      updateCounter: jest.fn(),
      updateName: jest.fn(),
      updateLastUsed: jest.fn(),
      delete: jest.fn(),
      countByUserId: jest.fn(),
    };

    // Create mock Redis client
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    service = new WebAuthnService(mockRepo, mockRedis);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('startRegistration', () => {
    it('should generate registration options and store challenge', async () => {
      // Arrange
      mockRepo.countByUserId.mockResolvedValue(Ok(2)); // User has 2 devices
      mockRepo.findByUserId.mockResolvedValue(Ok([mockCredential]));

      const mockOptions = {
        challenge: mockChallenge,
        rp: { name: mockRpName, id: mockRpId },
        user: { id: mockUserId, name: mockUserId, displayName: mockUserId },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
        timeout: 60000,
        attestation: 'none' as const,
        excludeCredentials: [
          {
            id: mockCredential.credentialId,
            type: 'public-key' as const,
            transports: mockCredential.transports,
          },
        ],
      };

      (generateRegistrationOptions as jest.Mock).mockResolvedValue(mockOptions);

      // Act
      const result = await service.startRegistration(mockUserId, mockRpName, mockRpId);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.challenge).toBe(mockChallenge);
        expect(result.value.options).toEqual(mockOptions);
      }

      expect(mockRepo.countByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(generateRegistrationOptions).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `webauthn:challenge:registration:${mockUserId}`,
        300,
        mockChallenge
      );
    });

    it('should reject when device limit exceeded', async () => {
      // Arrange
      mockRepo.countByUserId.mockResolvedValue(Ok(5)); // User has 5 devices (max)

      // Act
      const result = await service.startRegistration(mockUserId, mockRpName, mockRpId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('DEVICE_LIMIT_EXCEEDED');
      }

      expect(mockRepo.findByUserId).not.toHaveBeenCalled();
      expect(generateRegistrationOptions).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRepo.countByUserId.mockResolvedValue(Err(new Error('Database error')));

      // Act
      const result = await service.startRegistration(mockUserId, mockRpName, mockRpId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('REPOSITORY_ERROR');
      }
    });
  });

  describe('completeRegistration', () => {
    const mockRegistrationRequest = {
      userId: mockUserId,
      credential: {
        id: 'credential-id',
        rawId: 'credential-raw-id',
        response: {
          clientDataJSON: 'client-data-json',
          attestationObject: 'attestation-object',
          transports: ['internal'] as any,
        },
        type: 'public-key' as const,
      },
      deviceName: 'My Test Device',
    };

    it('should verify and save credential', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);

      const mockVerification = {
        verified: true,
        registrationInfo: {
          credentialPublicKey: Buffer.from('public-key'),
          credentialID: Buffer.from('credential-id'),
          counter: 0,
          aaguid: Buffer.from('aaguid'),
        },
      };

      (verifyRegistrationResponse as jest.Mock).mockResolvedValue(mockVerification);
      mockRepo.create.mockResolvedValue(Ok(mockCredential));

      // Act
      const result = await service.completeRegistration(
        mockRegistrationRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.success).toBe(true);
        expect(result.value.credentialId).toBe(mockCredential.credentialId);
        expect(result.value.deviceName).toBe(mockCredential.deviceName);
      }

      expect(mockRedis.get).toHaveBeenCalledWith(`webauthn:challenge:registration:${mockUserId}`);
      expect(verifyRegistrationResponse).toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`webauthn:challenge:registration:${mockUserId}`);
    });

    it('should reject when challenge not found', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.completeRegistration(
        mockRegistrationRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CHALLENGE_NOT_FOUND');
      }

      expect(verifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('should reject when challenge mismatch', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue('different-challenge');

      // Act
      const result = await service.completeRegistration(
        mockRegistrationRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CHALLENGE_EXPIRED');
      }
    });

    it('should reject when verification fails', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: false,
      });

      // Act
      const result = await service.completeRegistration(
        mockRegistrationRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VERIFICATION_FAILED');
      }
    });
  });

  describe('startAuthentication', () => {
    it('should generate authentication options and store challenge', async () => {
      // Arrange
      mockRepo.findByUserId.mockResolvedValue(Ok([mockCredential]));

      const mockOptions = {
        challenge: mockChallenge,
        timeout: 60000,
        rpId: mockRpId,
        allowCredentials: [
          {
            id: mockCredential.credentialId,
            type: 'public-key' as const,
            transports: mockCredential.transports,
          },
        ],
      };

      (generateAuthenticationOptions as jest.Mock).mockResolvedValue(mockOptions);

      // Act
      const result = await service.startAuthentication(mockUserId, mockRpId);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.challenge).toBe(mockChallenge);
        expect(result.value.options).toEqual(mockOptions);
      }

      expect(mockRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(generateAuthenticationOptions).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `webauthn:challenge:authentication:${mockUserId}`,
        300,
        mockChallenge
      );
    });

    it('should reject when user has no credentials', async () => {
      // Arrange
      mockRepo.findByUserId.mockResolvedValue(Ok([]));

      // Act
      const result = await service.startAuthentication(mockUserId, mockRpId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('NOT_ENROLLED');
      }

      expect(generateAuthenticationOptions).not.toHaveBeenCalled();
    });
  });

  describe('completeAuthentication', () => {
    const mockAuthRequest = {
      userId: mockUserId,
      credential: {
        id: 'credential-id',
        rawId: Buffer.from('credential-id-base64url', 'base64url').toString('base64'),
        response: {
          clientDataJSON: 'client-data-json',
          authenticatorData: 'authenticator-data',
          signature: 'signature',
        },
        type: 'public-key' as const,
      },
    };

    it('should verify signature and update counter', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      mockRepo.findByCredentialId.mockResolvedValue(Ok(mockCredential));

      const mockVerification = {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          userVerified: true,
        },
      };

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue(mockVerification);
      mockRepo.updateCounter.mockResolvedValue(Ok(true));
      mockRepo.updateLastUsed.mockResolvedValue(Ok(true));

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.success).toBe(true);
        expect(result.value.credentialId).toBe(mockCredential.credentialId);
      }

      expect(mockRedis.get).toHaveBeenCalledWith(`webauthn:challenge:authentication:${mockUserId}`);
      expect(verifyAuthenticationResponse).toHaveBeenCalled();
      expect(mockRepo.updateCounter).toHaveBeenCalledWith(mockCredential.credentialId, 1);
      expect(mockRepo.updateLastUsed).toHaveBeenCalledWith(mockCredential.credentialId);
      expect(mockRedis.del).toHaveBeenCalledWith(`webauthn:challenge:authentication:${mockUserId}`);
    });

    it('should reject when challenge not found', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CHALLENGE_NOT_FOUND');
      }
    });

    it('should reject when credential not found', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      mockRepo.findByCredentialId.mockResolvedValue(Ok(null));

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CREDENTIAL_NOT_FOUND');
      }
    });

    it('should reject when credential belongs to different user', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      const differentUserCredential = { ...mockCredential, userId: 'different-user' };
      mockRepo.findByCredentialId.mockResolvedValue(Ok(differentUserCredential));

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIAL');
      }
    });

    it('should reject when counter does not increase (replay attack)', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      const credentialWithCounter = { ...mockCredential, counter: 5 };
      mockRepo.findByCredentialId.mockResolvedValue(Ok(credentialWithCounter));

      const mockVerification = {
        verified: true,
        authenticationInfo: {
          newCounter: 5, // Same as old counter - replay attack!
          userVerified: true,
        },
      };

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue(mockVerification);

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('COUNTER_MISMATCH');
      }

      expect(mockRepo.updateCounter).not.toHaveBeenCalled();
    });

    it('should reject when verification fails', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(mockChallenge);
      mockRepo.findByCredentialId.mockResolvedValue(Ok(mockCredential));

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: false,
      });

      // Act
      const result = await service.completeAuthentication(
        mockAuthRequest,
        mockChallenge,
        mockRpId,
        mockOrigin
      );

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('VERIFICATION_FAILED');
      }
    });
  });

  describe('getCredentials', () => {
    it('should return user credentials', async () => {
      // Arrange
      const credentials = [mockCredential];
      mockRepo.findByUserId.mockResolvedValue(Ok(credentials));

      // Act
      const result = await service.getCredentials(mockUserId);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual({
          id: mockCredential.id,
          credentialId: mockCredential.credentialId,
          deviceName: mockCredential.deviceName,
          createdAt: mockCredential.createdAt,
          lastUsedAt: mockCredential.lastUsedAt,
        });
      }

      expect(mockRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRepo.findByUserId.mockResolvedValue(Err(new Error('Database error')));

      // Act
      const result = await service.getCredentials(mockUserId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('REPOSITORY_ERROR');
      }
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential', async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(Ok(mockCredential));
      mockRepo.delete.mockResolvedValue(Ok(true));

      // Act
      const result = await service.deleteCredential(mockUserId, mockCredentialId);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }

      expect(mockRepo.findById).toHaveBeenCalledWith(mockCredentialId);
      expect(mockRepo.delete).toHaveBeenCalledWith(mockCredentialId);
    });

    it('should reject when credential not found', async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(Ok(null));

      // Act
      const result = await service.deleteCredential(mockUserId, mockCredentialId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CREDENTIAL_NOT_FOUND');
      }

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should reject when credential belongs to different user', async () => {
      // Arrange
      const differentUserCredential = { ...mockCredential, userId: 'different-user' };
      mockRepo.findById.mockResolvedValue(Ok(differentUserCredential));

      // Act
      const result = await service.deleteCredential(mockUserId, mockCredentialId);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIAL');
      }

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateCredentialName', () => {
    const newName = 'Updated Device Name';

    it('should update credential name', async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(Ok(mockCredential));
      mockRepo.updateName.mockResolvedValue(Ok(true));

      // Act
      const result = await service.updateCredentialName(mockUserId, mockCredentialId, newName);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }

      expect(mockRepo.findById).toHaveBeenCalledWith(mockCredentialId);
      expect(mockRepo.updateName).toHaveBeenCalledWith(mockCredentialId, newName);
    });

    it('should reject when credential not found', async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(Ok(null));

      // Act
      const result = await service.updateCredentialName(mockUserId, mockCredentialId, newName);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('CREDENTIAL_NOT_FOUND');
      }

      expect(mockRepo.updateName).not.toHaveBeenCalled();
    });

    it('should reject when credential belongs to different user', async () => {
      // Arrange
      const differentUserCredential = { ...mockCredential, userId: 'different-user' };
      mockRepo.findById.mockResolvedValue(Ok(differentUserCredential));

      // Act
      const result = await service.updateCredentialName(mockUserId, mockCredentialId, newName);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('INVALID_CREDENTIAL');
      }

      expect(mockRepo.updateName).not.toHaveBeenCalled();
    });
  });
});
