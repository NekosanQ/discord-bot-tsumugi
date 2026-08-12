import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpaqueClientId, isOpaqueClientId, readWebApiProxyToken } from '../../../src/infrastructure/security/clientIdentity.js';

void test('client identityはproxy tokenで不可逆な固定長IDへ変換する', (): void => {
    const token = 'proxy-token'.repeat(4);
    const first = createOpaqueClientId('ip:203.0.113.10', token);
    const second = createOpaqueClientId('ip:203.0.113.10', token);
    assert.equal(first, second);
    assert.equal(first.includes('203.0.113.10'), false);
    assert.equal(isOpaqueClientId(first), true);
    assert.equal(isOpaqueClientId('browser-value'), false);
});

void test('proxy tokenは32byte未満を拒否する', (): void => {
    assert.equal(readWebApiProxyToken('x'.repeat(32)), 'x'.repeat(32));
    assert.throws((): void => {
        readWebApiProxyToken('too-short');
    }, /32byte/);
});
