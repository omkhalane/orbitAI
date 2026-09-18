import crypto from 'crypto';

// Encryption key derived from environment variable or deterministic server machine secret
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'orbit-ai-secret-key-32bytes-long-secure-salt-2026';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

export interface EncryptedPayload {
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

/**
 * Encrypt a plaintext secret using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const payload: EncryptedPayload = {
    iv: iv.toString('hex'),
    tag,
    data: encrypted,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted payload back to plaintext string.
 */
export function decryptSecret(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  try {
    const rawJson = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const payload: EncryptedPayload = JSON.parse(rawJson);
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm', 
      KEY, 
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret:', err);
    throw new Error('Credential decryption failed. The credential may be corrupted or invalid.');
  }
}

/**
 * Produce a safe masked version of a secret for UI display.
 * E.g. "sk-proj-1234567890abcdef" -> "sk-pr...cdef"
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
