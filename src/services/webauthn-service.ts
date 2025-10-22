/**
 * WebAuthn Service
 * Task 5.5: WebAuthn (FIDO2) Authentication
 *
 * FIDO2/WebAuthn passwordless authentication service
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type { Redis as RedisClient } from 'ioredis';
import { Result, Ok, Err } from '../types/result';
import {
  IWebAuthnService,
  IWebAuthnCredentialRepository,
  WebAuthnError,
  WebAuthnErrorType,
  WebAuthnRegistrationStartResponse,
  WebAuthnRegistrationCompleteRequest,
  WebAuthnRegistrationCompleteResponse,
  WebAuthnAuthenticationStartResponse,
  WebAuthnAuthenticationCompleteRequest,
  WebAuthnAuthenticationCompleteResponse,
  WebAuthnCredentialListItem,
  AuthenticatorTransport,
  WEBAUTHN_ERROR_MESSAGES_JA,
} from '../types/webauthn';
import { logger } from '../config/logger';

// Constants
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes
const CHALLENGE_PREFIX = 'webauthn:challenge:';
const MAX_DEVICES_PER_USER = 5;
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_DEVICE_NAME = 'Unknown Device';

/**
 * WebAuthn Service Implementation
 */
export class WebAuthnService implements IWebAuthnService {
  constructor(
    private readonly credentialRepository: IWebAuthnCredentialRepository,
    private readonly redis: RedisClient
  ) {}

  /**
   * Start WebAuthn registration (generate challenge and options)
   */
  async startRegistration(
    userId: string,
    userEmail: string,
    rpName: string,
    rpId: string
  ): Promise<Result<WebAuthnRegistrationStartResponse, WebAuthnError>> {
    try {
      // Check device limit
      const countResult = await this.credentialRepository.countByUserId(userId);
      if (!countResult.success) {
        logger.error('Failed to count user credentials', { error: countResult.error, userId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to check device limit'));
      }

      if (countResult.value >= MAX_DEVICES_PER_USER) {
        logger.warn('Device limit exceeded', { userId, count: countResult.value });
        return Err(
          this.createError(
            'DEVICE_LIMIT_EXCEEDED',
            `Maximum ${MAX_DEVICES_PER_USER} devices allowed`
          )
        );
      }

      // Get existing credentials for excludeCredentials (prevent re-registering same authenticator)
      const credentialsResult = await this.credentialRepository.findByUserId(userId);
      if (!credentialsResult.success) {
        logger.error('Failed to fetch existing credentials', { error: credentialsResult.error, userId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to fetch existing credentials'));
      }

      const excludeCredentials = credentialsResult.value.map((cred) => ({
        id: cred.credentialId,
        type: 'public-key' as const,
        transports: cred.transports,
      }));

      // Generate registration options
      const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: new TextEncoder().encode(userId) as Uint8Array<ArrayBuffer>,
        userName: userEmail, // Use email as username for better UX
        userDisplayName: userEmail, // Display email in authenticator
        timeout: DEFAULT_TIMEOUT,
        attestationType: 'none', // 'none' for privacy, 'direct' for hardware attestation
        excludeCredentials,
        authenticatorSelection: {
          residentKey: 'required', // REQUIRED for discoverable credentials (passwordless)
          userVerification: 'required', // REQUIRED for security
          authenticatorAttachment: undefined, // Allow both platform and cross-platform
        },
        supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
      });

      // Store challenge in Redis with TTL
      const challengeKey = this.getChallengeKey(userId, 'registration');
      await this.redis.setex(challengeKey, CHALLENGE_TTL_SECONDS, options.challenge);

      logger.info('WebAuthn registration started', { userId, rpId });

      return Ok({
        options,
        challenge: options.challenge,
      });
    } catch (error) {
      logger.error('Failed to start WebAuthn registration', { error, userId, rpId });
      return Err(
        this.createError(
          'REGISTRATION_FAILED',
          error instanceof Error ? error.message : 'Failed to start registration'
        )
      );
    }
  }

  /**
   * Complete WebAuthn registration (verify and save credential)
   */
  async completeRegistration(
    request: WebAuthnRegistrationCompleteRequest,
    rpId: string,
    origin: string
  ): Promise<Result<WebAuthnRegistrationCompleteResponse, WebAuthnError>> {
    try {
      // Verify challenge exists in Redis
      const challengeKey = this.getChallengeKey(request.userId, 'registration');
      const storedChallenge = await this.redis.get(challengeKey);

      if (!storedChallenge) {
        logger.warn('Challenge not found or expired', { userId: request.userId });
        return Err(this.createError('CHALLENGE_NOT_FOUND', 'Challenge not found or expired'));
      }

      // Verify registration response
      let verification: VerifiedRegistrationResponse;
      try {
        verification = await verifyRegistrationResponse({
          response: request.credential as any, // Type compatibility with @simplewebauthn/server
          expectedChallenge: storedChallenge, // Use challenge from Redis
          expectedOrigin: origin,
          expectedRPID: rpId,
          requireUserVerification: false, // Don't require UV (some authenticators don't support it)
        });
      } catch (error) {
        logger.error('Registration verification failed', { error, userId: request.userId });
        return Err(
          this.createError(
            'VERIFICATION_FAILED',
            error instanceof Error ? error.message : 'Verification failed'
          )
        );
      }

      if (!verification.verified || !verification.registrationInfo) {
        logger.warn('Registration not verified', { userId: request.userId });
        return Err(this.createError('VERIFICATION_FAILED', 'Registration verification failed'));
      }

      const { credential: verifiedCred, aaguid } = verification.registrationInfo;

      // verifiedCred.id is already base64url encoded
      // Convert public key Uint8Array to base64url for storage
      const credentialIdBase64 = verifiedCred.id;
      const publicKeyBase64 = Buffer.from(verifiedCred.publicKey).toString('base64url');

      // Extract transports from credential response
      const transports = request.credential.response.transports as AuthenticatorTransport[] | undefined;

      // Create credential in database
      const createResult = await this.credentialRepository.create({
        userId: request.userId,
        credentialId: credentialIdBase64,
        publicKey: publicKeyBase64,
        counter: verifiedCred.counter,
        transports,
        deviceName: request.deviceName || DEFAULT_DEVICE_NAME,
        aaguid: aaguid || undefined,
      });

      if (!createResult.success) {
        logger.error('Failed to save credential', { error: createResult.error, userId: request.userId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to save credential'));
      }

      const savedCredential = createResult.value;

      // Delete challenge from Redis
      await this.redis.del(challengeKey);

      logger.info('WebAuthn registration completed', {
        userId: request.userId,
        credentialId: credentialIdBase64,
        deviceName: savedCredential.deviceName,
      });

      return Ok({
        success: true,
        credentialId: savedCredential.credentialId,
        deviceName: savedCredential.deviceName,
        createdAt: savedCredential.createdAt,
      });
    } catch (error) {
      logger.error('Failed to complete WebAuthn registration', { error, userId: request.userId });
      return Err(
        this.createError(
          'REGISTRATION_FAILED',
          error instanceof Error ? error.message : 'Failed to complete registration'
        )
      );
    }
  }

  /**
   * Start WebAuthn authentication (generate challenge and options)
   * Supports both traditional (with userId) and discoverable credential (passwordless) modes
   */
  async startAuthentication(
    userId: string | undefined,
    rpId: string
  ): Promise<Result<WebAuthnAuthenticationStartResponse, WebAuthnError>> {
    try {
      let allowCredentials: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }> = [];

      // Traditional mode: userId provided
      if (userId) {
        const credentialsResult = await this.credentialRepository.findByUserId(userId);
        if (!credentialsResult.success) {
          logger.error('Failed to fetch credentials', { error: credentialsResult.error, userId });
          return Err(this.createError('REPOSITORY_ERROR', 'Failed to fetch credentials'));
        }

        if (credentialsResult.value.length === 0) {
          logger.warn('No credentials found for user', { userId });
          return Err(this.createError('NOT_ENROLLED', 'No WebAuthn credentials registered'));
        }

        allowCredentials = credentialsResult.value.map((cred) => ({
          id: cred.credentialId,
          type: 'public-key' as const,
          transports: cred.transports,
        }));
      }
      // Discoverable mode: no userId, empty allowCredentials triggers resident key selection
      // The authenticator will present all resident keys for this RP

      // Generate authentication options
      const options = await generateAuthenticationOptions({
        rpID: rpId,
        timeout: DEFAULT_TIMEOUT,
        allowCredentials, // Empty for discoverable, populated for traditional
        userVerification: 'required', // REQUIRED for discoverable credentials security
      });

      // Store challenge in Redis with challenge as key (for discoverable mode)
      // In discoverable mode, we don't have userId yet, so use challenge as key
      const challengeKey = userId
        ? this.getChallengeKey(userId, 'authentication')
        : `webauthn:challenge:discoverable:${options.challenge}`;
      await this.redis.setex(challengeKey, CHALLENGE_TTL_SECONDS, options.challenge);

      logger.info('WebAuthn authentication started', {
        userId: userId || 'discoverable',
        rpId,
        mode: userId ? 'traditional' : 'discoverable'
      });

      return Ok({
        options,
        challenge: options.challenge,
      });
    } catch (error) {
      logger.error('Failed to start WebAuthn authentication', { error, userId, rpId });
      return Err(
        this.createError(
          'AUTHENTICATION_FAILED',
          error instanceof Error ? error.message : 'Failed to start authentication'
        )
      );
    }
  }

  /**
   * Complete WebAuthn authentication (verify signature)
   * Supports both traditional (with userId) and discoverable credential (passwordless) modes
   */
  async completeAuthentication(
    request: WebAuthnAuthenticationCompleteRequest,
    rpId: string,
    origin: string
  ): Promise<Result<WebAuthnAuthenticationCompleteResponse, WebAuthnError>> {
    try {
      // Extract userId from userHandle if present (discoverable credential mode)
      let userId = request.userId;

      if (request.credential.response.userHandle) {
        // Discoverable credential: userHandle contains the userId (encoded as base64URL)
        const userHandleBuffer = Buffer.from(request.credential.response.userHandle, 'base64');
        const extractedUserId = new TextDecoder().decode(userHandleBuffer);

        logger.debug('Extracted userId from userHandle (discoverable mode)', {
          providedUserId: request.userId,
          extractedUserId,
        });

        // Use extracted userId for verification
        userId = extractedUserId;
      }

      if (!userId) {
        logger.warn('No userId provided and no userHandle in response');
        return Err(this.createError('AUTHENTICATION_FAILED', 'Unable to identify user'));
      }

      // Try to get challenge from Redis
      // First try user-specific key, then try discoverable key
      let challengeKey = this.getChallengeKey(userId, 'authentication');
      let storedChallenge = await this.redis.get(challengeKey);

      // If not found, try discoverable challenge key format
      if (!storedChallenge && request.credential.response.clientDataJSON) {
        // Extract challenge from clientDataJSON to find the discoverable key
        const clientDataBuffer = Buffer.from(request.credential.response.clientDataJSON, 'base64');
        const clientData = JSON.parse(new TextDecoder().decode(clientDataBuffer));
        const discoverableChallengeKey = `webauthn:challenge:discoverable:${clientData.challenge}`;
        storedChallenge = await this.redis.get(discoverableChallengeKey);

        if (storedChallenge) {
          challengeKey = discoverableChallengeKey;
          logger.debug('Found challenge using discoverable key', { challengeKey });
        }
      }

      if (!storedChallenge) {
        logger.warn('Challenge not found or expired', { userId, challengeKey });
        return Err(this.createError('CHALLENGE_NOT_FOUND', 'Challenge not found or expired'));
      }

      // Find credential
      const credentialIdBase64 = Buffer.from(request.credential.rawId, 'base64').toString('base64url');
      const credentialResult = await this.credentialRepository.findByCredentialId(credentialIdBase64);

      if (!credentialResult.success) {
        logger.error('Failed to find credential', { error: credentialResult.error, credentialId: credentialIdBase64 });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to find credential'));
      }

      if (!credentialResult.value) {
        logger.warn('Credential not found', { credentialId: credentialIdBase64 });
        return Err(this.createError('CREDENTIAL_NOT_FOUND', 'Credential not found'));
      }

      const credential = credentialResult.value;

      // Verify user owns this credential
      if (credential.userId !== userId) {
        logger.warn('Credential does not belong to user', {
          userId: userId,
          credentialUserId: credential.userId,
        });
        return Err(this.createError('INVALID_CREDENTIAL', 'Credential does not belong to user'));
      }

      // Decode public key from base64url
      const publicKey = Buffer.from(credential.publicKey, 'base64url');

      // Verify authentication response
      let verification: VerifiedAuthenticationResponse;
      try {
        verification = await verifyAuthenticationResponse({
          response: request.credential as any, // Type compatibility
          expectedChallenge: storedChallenge, // Use challenge from Redis
          expectedOrigin: origin,
          expectedRPID: rpId,
          credential: {
            id: credential.credentialId, // Already base64url encoded
            publicKey: publicKey,
            counter: credential.counter,
            transports: credential.transports,
          },
          requireUserVerification: false,
        });
      } catch (error) {
        logger.error('Authentication verification failed', { error, userId });
        return Err(
          this.createError(
            'VERIFICATION_FAILED',
            error instanceof Error ? error.message : 'Verification failed'
          )
        );
      }

      if (!verification.verified) {
        logger.warn('Authentication not verified', { userId });
        return Err(this.createError('VERIFICATION_FAILED', 'Authentication verification failed'));
      }

      const { newCounter } = verification.authenticationInfo;

      // Check counter for replay attack (counter must increase)
      // Note: If both counters are 0, the authenticator doesn't support counters (skip check)
      if (credential.counter > 0 || newCounter > 0) {
        if (newCounter <= credential.counter) {
          logger.error('Counter mismatch - possible replay attack', {
            userId,
            credentialId: credentialIdBase64,
            oldCounter: credential.counter,
            newCounter,
          });
          return Err(
            this.createError(
              'COUNTER_MISMATCH',
              'Possible replay attack detected - counter did not increase'
            )
          );
        }
      } else {
        logger.debug('Counter check skipped - authenticator does not support counters', {
          userId,
        });
      }

      // Update counter and last used timestamp
      const updateCounterResult = await this.credentialRepository.updateCounter(
        credential.credentialId,
        newCounter
      );

      if (!updateCounterResult.success) {
        logger.error('Failed to update counter', { error: updateCounterResult.error });
        // Continue anyway - authentication was successful
      }

      const updateLastUsedResult = await this.credentialRepository.updateLastUsed(
        credential.credentialId
      );

      if (!updateLastUsedResult.success) {
        logger.error('Failed to update last used', { error: updateLastUsedResult.error });
        // Continue anyway - authentication was successful
      }

      // Delete challenge from Redis
      await this.redis.del(challengeKey);

      logger.info('WebAuthn authentication completed', {
        userId,
        credentialId: credentialIdBase64,
        mode: request.credential.response.userHandle ? 'discoverable' : 'traditional',
      });

      return Ok({
        success: true,
        userId, // Return the authenticated userId
        credentialId: credential.credentialId,
        authenticatedAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to complete WebAuthn authentication', { error, userId: request.userId });
      return Err(
        this.createError(
          'AUTHENTICATION_FAILED',
          error instanceof Error ? error.message : 'Failed to complete authentication'
        )
      );
    }
  }

  /**
   * Get user's WebAuthn credentials
   */
  async getCredentials(
    userId: string
  ): Promise<Result<WebAuthnCredentialListItem[], WebAuthnError>> {
    try {
      const credentialsResult = await this.credentialRepository.findByUserId(userId);

      if (!credentialsResult.success) {
        logger.error('Failed to fetch credentials', { error: credentialsResult.error, userId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to fetch credentials'));
      }

      const credentials: WebAuthnCredentialListItem[] = credentialsResult.value.map((cred) => ({
        id: cred.id,
        credentialId: cred.credentialId,
        deviceName: cred.deviceName,
        createdAt: cred.createdAt,
        lastUsedAt: cred.lastUsedAt,
      }));

      return Ok(credentials);
    } catch (error) {
      logger.error('Failed to get credentials', { error, userId });
      return Err(
        this.createError(
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Failed to get credentials'
        )
      );
    }
  }

  /**
   * Delete a WebAuthn credential
   */
  async deleteCredential(
    userId: string,
    credentialId: string
  ): Promise<Result<boolean, WebAuthnError>> {
    try {
      // Find credential by UUID (id field)
      const credentialResult = await this.credentialRepository.findById(credentialId);

      if (!credentialResult.success) {
        logger.error('Failed to find credential', { error: credentialResult.error, credentialId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to find credential'));
      }

      if (!credentialResult.value) {
        logger.warn('Credential not found', { credentialId });
        return Err(this.createError('CREDENTIAL_NOT_FOUND', 'Credential not found'));
      }

      // Verify user owns this credential
      if (credentialResult.value.userId !== userId) {
        logger.warn('Credential does not belong to user', {
          userId,
          credentialUserId: credentialResult.value.userId,
        });
        return Err(this.createError('INVALID_CREDENTIAL', 'Credential does not belong to user'));
      }

      // Delete credential
      const deleteResult = await this.credentialRepository.delete(credentialId);

      if (!deleteResult.success) {
        logger.error('Failed to delete credential', { error: deleteResult.error, credentialId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to delete credential'));
      }

      logger.info('Credential deleted', { userId, credentialId });

      return Ok(deleteResult.value);
    } catch (error) {
      logger.error('Failed to delete credential', { error, userId, credentialId });
      return Err(
        this.createError(
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Failed to delete credential'
        )
      );
    }
  }

  /**
   * Update credential name
   */
  async updateCredentialName(
    userId: string,
    credentialId: string,
    name: string
  ): Promise<Result<boolean, WebAuthnError>> {
    try {
      // Find credential by UUID (id field)
      const credentialResult = await this.credentialRepository.findById(credentialId);

      if (!credentialResult.success) {
        logger.error('Failed to find credential', { error: credentialResult.error, credentialId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to find credential'));
      }

      if (!credentialResult.value) {
        logger.warn('Credential not found', { credentialId });
        return Err(this.createError('CREDENTIAL_NOT_FOUND', 'Credential not found'));
      }

      // Verify user owns this credential
      if (credentialResult.value.userId !== userId) {
        logger.warn('Credential does not belong to user', {
          userId,
          credentialUserId: credentialResult.value.userId,
        });
        return Err(this.createError('INVALID_CREDENTIAL', 'Credential does not belong to user'));
      }

      // Update name
      const updateResult = await this.credentialRepository.updateName(credentialId, name);

      if (!updateResult.success) {
        logger.error('Failed to update credential name', { error: updateResult.error, credentialId });
        return Err(this.createError('REPOSITORY_ERROR', 'Failed to update credential name'));
      }

      logger.info('Credential name updated', { userId, credentialId, name });

      return Ok(updateResult.value);
    } catch (error) {
      logger.error('Failed to update credential name', { error, userId, credentialId });
      return Err(
        this.createError(
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Failed to update credential name'
        )
      );
    }
  }

  /**
   * Generate Redis key for challenge storage
   */
  private getChallengeKey(userId: string, type: 'registration' | 'authentication'): string {
    return `${CHALLENGE_PREFIX}${type}:${userId}`;
  }

  /**
   * Create WebAuthn error with Japanese message
   */
  private createError(type: WebAuthnErrorType, _fallbackMessage?: string): WebAuthnError {
    return {
      type,
      message: WEBAUTHN_ERROR_MESSAGES_JA[type],
      timestamp: new Date(),
    };
  }
}
