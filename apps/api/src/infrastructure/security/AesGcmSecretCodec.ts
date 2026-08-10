import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { SecretCodec } from '../../application/dashboard/DashboardPorts.js';

function decodeKey(value: string, name: string): Buffer {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new TypeError(`${name}はbase64形式である必要があります。`);
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32) throw new TypeError(`${name}は32 byteのbase64値である必要があります。`);
    return decoded;
}

export class AesGcmSecretCodec implements SecretCodec {
    private readonly encryptionKey: Buffer;
    private readonly digestKey: Buffer;

    public constructor(encryptionKeyBase64: string, digestKeyBase64: string) {
        this.encryptionKey = decodeKey(encryptionKeyBase64, 'API_SESSION_ENCRYPTION_KEY');
        this.digestKey = decodeKey(digestKeyBase64, 'API_SESSION_SECRET');
    }

    public randomToken(): string {
        return randomBytes(32).toString('base64url');
    }

    public digest(value: string): string {
        return createHmac('sha256', this.digestKey).update(value, 'utf8').digest('hex');
    }

    public protect(value: string): string {
        const initializationVector = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, initializationVector);
        const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        const authenticationTag = cipher.getAuthTag();
        return ['v1', initializationVector.toString('base64url'), authenticationTag.toString('base64url'), ciphertext.toString('base64url')].join(
            '.'
        );
    }

    public unprotect(value: string): string {
        const parts = value.split('.');
        if (parts.length !== 4) {
            throw new TypeError('暗号化tokenの形式が不正です。');
        }
        const [version, encodedInitializationVector, encodedAuthenticationTag, encodedCiphertext] = parts;
        if (version !== 'v1' || !encodedInitializationVector || !encodedAuthenticationTag) {
            throw new TypeError('暗号化tokenの形式が不正です。');
        }
        try {
            const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(encodedInitializationVector, 'base64url'));
            decipher.setAuthTag(Buffer.from(encodedAuthenticationTag, 'base64url'));
            return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64url')), decipher.final()]).toString('utf8');
        } catch (error) {
            throw new TypeError('暗号化tokenを復号できません。', { cause: error });
        }
    }

    public equals(left: string, right: string): boolean {
        const leftBuffer = Buffer.from(left);
        const rightBuffer = Buffer.from(right);
        return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
    }
}
