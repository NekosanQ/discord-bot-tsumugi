import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createKeyword } from '../../../../../src/domain/keyword/Keyword.js';
import { InMemoryKeywordLookupCache } from '../../../../../src/infrastructure/cache/memory/keyword/InMemoryKeywordLookupCache.js';

const scope = { guildId: '12345678901234567', channelId: '22345678901234567' } as const;
const keyword = createKeyword({ ...scope, trigger: '猫', responses: ['にゃー'] });

void describe('InMemoryKeywordLookupCache', () => {
    void it('TTL内の値を返し、期限切れ後はmissにする', async () => {
        let now = 1_000;
        const cache = new InMemoryKeywordLookupCache({ ttlMs: 100, maxEntries: 2, now: (): number => now });

        await cache.set(scope, [keyword]);
        assert.deepEqual(await cache.get(scope), [keyword]);

        now += 100;
        assert.equal(await cache.get(scope), undefined);
    });

    void it('上限超過時は最も古く使われたscopeを破棄する', async () => {
        const cache = new InMemoryKeywordLookupCache({ ttlMs: 100, maxEntries: 1 });
        const anotherScope = { guildId: scope.guildId, channelId: '32345678901234567' };

        await cache.set(scope, [keyword]);
        await cache.set(anotherScope, []);

        assert.equal(await cache.get(scope), undefined);
        assert.deepEqual(await cache.get(anotherScope), []);
    });

    void it('scope単位で無効化する', async () => {
        const cache = new InMemoryKeywordLookupCache({ ttlMs: 100, maxEntries: 1 });
        await cache.set(scope, [keyword]);

        await cache.invalidate(scope);

        assert.equal(await cache.get(scope), undefined);
    });
});
