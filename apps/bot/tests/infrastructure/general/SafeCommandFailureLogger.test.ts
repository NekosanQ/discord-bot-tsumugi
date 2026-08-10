import assert from 'node:assert/strict';
import test from 'node:test';

import { SafeCommandFailureLogger } from '../../../src/infrastructure/general/SafeCommandFailureLogger.js';

void test('User取得失敗のログへDiscord IDやerror本文を渡さない', (): void => {
    const entries: { message: string; detail: unknown }[] = [];
    const logger = new SafeCommandFailureLogger({
        error: (message: string, detail?: unknown): void => {
            entries.push({ message, detail });
        }
    });

    logger.failure('user-member-fetch', new Error('user 123456789012345678 sensitive-detail'));

    assert.deepEqual(entries, [
        {
            message: 'ユーザー情報用メンバーの取得に失敗しました',
            detail: 'Error'
        }
    ]);
    const serialized = JSON.stringify(entries);
    assert.equal(serialized.includes('123456789012345678'), false);
    assert.equal(serialized.includes('sensitive-detail'), false);
});
