import assert from 'node:assert/strict';
import test from 'node:test';

import { loadApiConfig } from '../../../src/infrastructure/config/config.js';

void test('環境別configがない場合は非秘密のexample設定へfallbackする', () => {
    const config = loadApiConfig(process.cwd(), 'missing-test-environment');
    assert.equal(config.port, 3000);
    assert.equal(config.requestTimeoutMs, 5000);
});
