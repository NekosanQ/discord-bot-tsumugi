import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KeywordNotFoundError } from '../../../src/application/keyword/KeywordApplicationErrors.js';
import type { KeywordLookupCache } from '../../../src/application/keyword/KeywordLookupCache.js';
import type { KeywordRepository, KeywordScope } from '../../../src/application/keyword/KeywordRepository.js';
import { KeywordService } from '../../../src/application/keyword/KeywordService.js';
import { createKeyword, type Keyword } from '../../../src/domain/keyword/Keyword.js';

const scope = { guildId: '12345678901234567', channelId: '22345678901234567' } as const;

class MemoryKeywordRepository implements KeywordRepository {
    public readonly values = new Map<string, Keyword>();
    public listCalls = 0;

    public async save(keyword: Keyword): Promise<void> {
        this.values.set(this.key(keyword, keyword.trigger), keyword);
        await Promise.resolve();
    }

    public async remove(keywordScope: KeywordScope, trigger: string): Promise<boolean> {
        await Promise.resolve();
        return this.values.delete(this.key(keywordScope, trigger));
    }

    public async findByTrigger(keywordScope: KeywordScope, trigger: string): Promise<Keyword | undefined> {
        await Promise.resolve();
        return this.values.get(this.key(keywordScope, trigger));
    }

    public async list(keywordScope: KeywordScope): Promise<Keyword[]> {
        await Promise.resolve();
        this.listCalls++;
        return [...this.values.values()].filter(
            (keyword) => keyword.guildId === keywordScope.guildId && keyword.channelId === keywordScope.channelId
        );
    }

    private key(keywordScope: KeywordScope, trigger: string): string {
        return `${keywordScope.guildId}:${keywordScope.channelId}:${trigger}`;
    }
}

class MemoryKeywordLookupCache implements KeywordLookupCache {
    public value: readonly Keyword[] | undefined;
    public invalidations = 0;
    public failGet = false;

    public async get(_scope: KeywordScope): Promise<readonly Keyword[] | undefined> {
        await Promise.resolve();
        if (this.failGet) throw new Error('cache unavailable');
        return this.value;
    }

    public async set(_scope: KeywordScope, keywords: readonly Keyword[]): Promise<void> {
        await Promise.resolve();
        this.value = keywords;
    }

    public async invalidate(_scope: KeywordScope): Promise<void> {
        await Promise.resolve();
        this.invalidations++;
        this.value = undefined;
    }
}

void describe('KeywordService', () => {
    void it('検証済みKeywordを保存して取得する', async () => {
        const repository = new MemoryKeywordRepository();
        const service = new KeywordService(repository);

        await service.save({ ...scope, trigger: '猫', responses: ['にゃー'] });

        assert.deepEqual(await service.get(scope, '猫'), { ...scope, trigger: '猫', responses: ['にゃー'] });
    });

    void it('存在しないKeywordの削除をnot foundとして返す', async () => {
        const service = new KeywordService(new MemoryKeywordRepository());
        await assert.rejects(service.remove(scope, 'なし'), KeywordNotFoundError);
    });

    void it('一覧をtrigger昇順で返す', async () => {
        const repository = new MemoryKeywordRepository();
        const service = new KeywordService(repository);
        await service.save({ ...scope, trigger: '犬', responses: ['わん'] });
        await service.save({ ...scope, trigger: '猫', responses: ['にゃー'] });

        assert.deepEqual(
            (await service.list(scope)).map((keyword): string => keyword.trigger),
            ['犬', '猫']
        );
    });

    void it('長いtriggerを優先し注入した乱数で応答を選ぶ', async () => {
        const repository = new MemoryKeywordRepository();
        const service = new KeywordService(repository, { random: (): number => 0.75 });
        await service.save({ ...scope, trigger: '猫', responses: ['短い'] });
        await service.save({ ...scope, trigger: '黒猫', responses: ['一番', '二番'] });

        assert.deepEqual(await service.resolve(scope, '黒猫です'), { trigger: '黒猫', response: '二番' });
    });

    void it('一覧と解決でcache-asideを使いDBの再読込を避ける', async () => {
        const repository = new MemoryKeywordRepository();
        const cache = new MemoryKeywordLookupCache();
        const service = new KeywordService(repository, { cache });
        await repository.save(createKeyword({ ...scope, trigger: '猫', responses: ['にゃー'] }));

        assert.equal((await service.list(scope)).length, 1);
        assert.deepEqual(await service.resolve(scope, '猫です'), { trigger: '猫', response: 'にゃー' });
        assert.equal(repository.listCalls, 1);
    });

    void it('DB更新成功後にcacheを無効化する', async () => {
        const repository = new MemoryKeywordRepository();
        const cache = new MemoryKeywordLookupCache();
        const service = new KeywordService(repository, { cache });

        await service.save({ ...scope, trigger: '猫', responses: ['にゃー'] });

        assert.equal(cache.invalidations, 1);
    });

    void it('cache障害時はDBへfallbackして処理を継続する', async () => {
        const repository = new MemoryKeywordRepository();
        const cache = new MemoryKeywordLookupCache();
        cache.failGet = true;
        const reported: string[] = [];
        const service = new KeywordService(repository, {
            cache,
            reportCacheError: (operation): void => {
                reported.push(operation);
            }
        });
        await repository.save(createKeyword({ ...scope, trigger: '猫', responses: ['にゃー'] }));

        assert.equal((await service.list(scope)).length, 1);
        assert.deepEqual(reported, ['get']);
    });
});
