import crypto from 'crypto';
import { config } from '../config/environment';

/**
 * CANONICALIZATION SPECIFICATION & RULES:
 *
 * Problem:
 * Standard JSON.stringify does not guarantee deterministic key ordering. Two logically
 * equivalent JSON objects (e.g. { a: 1, b: 2 } and { b: 2, a: 1 }) produce different
 * string representations and therefore produce different HMAC signatures.
 *
 * Canonicalization Rules:
 * 1. Objects: Object property keys are sorted lexicographically (Unicode code point order).
 *    Whitespace is eliminated (no spaces between keys, colons, or commas).
 * 2. Arrays: Array element order is strictly preserved. Each element is recursively canonicalized.
 * 3. Primitives:
 *    - Strings: Escaped consistently following standard JSON UTF-8 escaping.
 *    - Numbers: Must be finite. Serialized using standard IEEE 754 decimal representation.
 *    - Booleans: Serialized as `true` or `false`.
 *    - Null: Serialized as `null`.
 * 4. Unsupported Types:
 *    - `undefined`, functions, symbols, BigInt, NaN, and Infinity throw an explicit error.
 *    - Circular references are detected via depth/ancestor tracking and rejected.
 *
 * Limitations:
 * - Floating point representations may vary across non-V8 runtimes.
 * - Map, Set, and custom classes must be converted to plain objects/arrays before signing.
 * - HMAC proves data integrity and authenticity only as long as the secret key remains uncompromised.
 */

// In-memory key registry supporting key rotation (keyId -> secret)
const keyRegistry = new Map<string, string>();

/**
 * Registers an HMAC secret for a specific keyId (for rotation / multi-key verification).
 */
export function registerHmacKey(keyId: string, secret: string): void {
  if (!secret || secret.trim().length < 16) {
    throw new Error('HMAC secret must be at least 16 characters long.');
  }
  keyRegistry.set(keyId, secret);
}

/**
 * Retrieves the secret for a given keyId, falling back to config.hmacSecret if matching.
 */
export function getSecretForKey(keyId: string): string | null {
  if (keyRegistry.has(keyId)) {
    return keyRegistry.get(keyId)!;
  }
  if (keyId === config.hmacKeyId && config.hmacSecret) {
    return config.hmacSecret;
  }
  return null;
}

/**
 * Canonicalizes data deterministically into a standard string representation.
 */
export function canonicalizeJson(value: any, seenObjects = new WeakSet()): string {
  if (value === undefined) {
    throw new Error('Canonicalization error: undefined values are unsupported.');
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`Canonicalization error: unsupported data type (${typeof value}).`);
  }
  if (typeof value === 'bigint') {
    throw new Error('Canonicalization error: BigInt is unsupported. Convert to string or number.');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonicalization error: NaN and Infinity are unsupported.');
    }
    return JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  // Circular reference detection
  if (typeof value === 'object') {
    if (seenObjects.has(value)) {
      throw new Error('Canonicalization error: circular reference detected.');
    }
    seenObjects.add(value);
  }

  // Arrays: preserve order, recursively canonicalize elements
  if (Array.isArray(value)) {
    const canonicalElements = value.map((elem) => canonicalizeJson(elem, seenObjects));
    seenObjects.delete(value);
    return `[${canonicalElements.join(',')}]`;
  }

  // Objects: sort keys lexicographically
  const keys = Object.keys(value).sort();
  const canonicalEntries = keys.map((key) => {
    const valStr = canonicalizeJson(value[key], seenObjects);
    return `${JSON.stringify(key)}:${valStr}`;
  });

  seenObjects.delete(value);
  return `{${canonicalEntries.join(',')}}`;
}

/**
 * Generates an HMAC-SHA256 signature for the given payload using canonicalized JSON.
 */
export function generateHmacSignature(data: any, keyId?: string, explicitSecret?: string): { signature: string; keyId: string } {
  const activeKeyId = keyId || config.hmacKeyId || 'sentinel-hmac-v1';
  const secret = explicitSecret || getSecretForKey(activeKeyId);

  if (!secret || secret.trim().length < 16) {
    throw new Error('HMAC secret is missing or insufficiently secure in environment configuration.');
  }

  const canonicalPayload = canonicalizeJson(data);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(canonicalPayload, 'utf8')
    .digest('hex');

  return { signature, keyId: activeKeyId };
}

/**
 * Verifies an HMAC-SHA256 signature against data using constant-time comparison.
 */
export function verifyHmacSignature(
  data: any,
  signature: string,
  keyId?: string,
  explicitSecret?: string
): { isValid: boolean; reason?: string } {
  const activeKeyId = keyId || config.hmacKeyId || 'sentinel-hmac-v1';
  const secret = explicitSecret || getSecretForKey(activeKeyId);

  if (!secret) {
    return { isValid: false, reason: `Unknown or unconfigured HMAC key identifier: "${activeKeyId}".` };
  }

  // Strict format validation: HMAC-SHA256 hex must be exactly 64 hexadecimal characters
  if (!signature || typeof signature !== 'string' || !/^[0-9a-fA-F]{64}$/.test(signature)) {
    return { isValid: false, reason: 'Malformed HMAC signature format. Expected 64-character hex string.' };
  }

  try {
    const canonicalPayload = canonicalizeJson(data);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(canonicalPayload, 'utf8')
      .digest('hex');

    const signatureBuf = Buffer.from(signature.toLowerCase(), 'hex');
    const expectedBuf = Buffer.from(expectedSignature.toLowerCase(), 'hex');

    if (signatureBuf.length !== expectedBuf.length) {
      return { isValid: false, reason: 'Signature buffer length mismatch.' };
    }

    const isValid = crypto.timingSafeEqual(signatureBuf, expectedBuf);
    return {
      isValid,
      reason: isValid ? undefined : 'HMAC signature mismatch: payload modification or invalid key detected.'
    };
  } catch (err: any) {
    return { isValid: false, reason: `HMAC verification failed: ${err.message}` };
  }
}
