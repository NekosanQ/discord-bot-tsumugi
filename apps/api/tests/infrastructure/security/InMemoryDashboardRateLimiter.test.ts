import assert from 'node:assert/strict';
import { it } from 'node:test';

import { InMemoryDashboardRateLimiter } from '../../../src/infrastructure/security/InMemoryDashboardRateLimiter.js';

void it('固定window内の上限を超えたrequestを拒否し期限後に回復する', async (): Promise<void> => {
    let now = 1000;
    const limiter = new InMemoryDashboardRateLimiter({ windowMs: 1000, limits: { oauthStart: 2, oauthCallback: 2, mutation: 1 } }, () => now);
    assert.equal(await limiter.consume('oauthStart', 'client'), true);
    assert.equal(await limiter.consume('oauthStart', 'client'), true);
    assert.equal(await limiter.consume('oauthStart', 'client'), false);
    assert.equal(await limiter.consume('oauthStart', 'other-client'), true);
    now += 1001;
    assert.equal(await limiter.consume('oauthStart', 'client'), true);
});
