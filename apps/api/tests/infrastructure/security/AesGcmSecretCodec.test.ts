import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AesGcmSecretCodec } from '../../../src/infrastructure/security/AesGcmSecretCodec.js';

const encryptionKey = Buffer.alloc(32, 1).toString('base64');
const digestKey = Buffer.alloc(32, 2).toString('base64');

void describe('AesGcmSecretCodec', (): void => {
    void it('tokenをAES-GCMで暗号化して復号する', (): void => {
        const codec = new AesGcmSecretCodec(encryptionKey, digestKey);
        const protectedValue = codec.protect('discord-access-token');
        assert.notEqual(protectedValue, 'discord-access-token');
        assert.equal(codec.unprotect(protectedValue), 'discord-access-token');
    });

    void it('改ざんされた暗号文を拒否する', (): void => {
        const codec = new AesGcmSecretCodec(encryptionKey, digestKey);
        const protectedValue = codec.protect('secret');
        assert.throws(() => codec.unprotect(`${protectedValue.slice(0, -1)}A`), TypeError);
    });

    void it('32 byteではない鍵を拒否する', (): void => {
        assert.throws(() => new AesGcmSecretCodec(Buffer.alloc(16).toString('base64'), digestKey), TypeError);
    });
});
