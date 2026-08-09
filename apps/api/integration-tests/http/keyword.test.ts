import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import type { ManagedGuildRepository } from '../../src/application/guild/ManagedGuildRepository.js';
import { ManagedGuildService } from '../../src/application/guild/ManagedGuildService.js';
import type { KeywordRepository, KeywordScope } from '../../src/application/keyword/KeywordRepository.js';
import { KeywordService } from '../../src/application/keyword/KeywordService.js';
import type { ManagedGuild } from '../../src/domain/guild/ManagedGuild.js';
import type { Keyword } from '../../src/domain/keyword/Keyword.js';
import { createKeywordHttpHandler } from '../../src/interface-adapter/http/keyword/createKeywordHttpHandler.js';

class MemoryKeywordRepository implements KeywordRepository {
    private readonly values = new Map<string, Keyword>();

    public async save(keyword: Keyword): Promise<void> {
        this.values.set(this.key(keyword, keyword.trigger), keyword);
        await Promise.resolve();
    }

    public async remove(scope: KeywordScope, trigger: string): Promise<boolean> {
        await Promise.resolve();
        return this.values.delete(this.key(scope, trigger));
    }

    public async findByTrigger(scope: KeywordScope, trigger: string): Promise<Keyword | undefined> {
        await Promise.resolve();
        return this.values.get(this.key(scope, trigger));
    }

    public async list(scope: KeywordScope): Promise<Keyword[]> {
        await Promise.resolve();
        return [...this.values.values()].filter((keyword) => keyword.guildId === scope.guildId && keyword.channelId === scope.channelId);
    }

    private key(scope: KeywordScope, trigger: string): string {
        return `${scope.guildId}:${scope.channelId}:${trigger}`;
    }
}

class MemoryManagedGuildRepository implements ManagedGuildRepository {
    public async saveInstallation(_guild: ManagedGuild): Promise<void> {
        await Promise.resolve();
    }
}

void test('service認証されたHTTP経路でKeywordを保存して解決する', async (): Promise<void> => {
    const token = 'a'.repeat(32);
    const service = new KeywordService(new MemoryKeywordRepository(), { random: (): number => 0 });
    const handler = createKeywordHttpHandler(service, new ManagedGuildService(new MemoryManagedGuildRepository()), {
        serviceToken: token,
        requestBodyLimitBytes: 16_384,
        readiness: (): Promise<boolean> => Promise.resolve(true),
        reportError: (): void => undefined
    });
    const server = createServer((request, response): void => void handler(request, response));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const headers = new Headers({ authorization: `Bearer ${token}` });
    headers.set('content-type', 'application/json');
    const anonymousHeaders = new Headers();
    anonymousHeaders.set('content-type', 'application/json');

    try {
        const unauthorized = await fetch(`${baseUrl}/v1/keywords/list`, {
            method: 'POST',
            body: '{}',
            headers: anonymousHeaders
        });
        assert.equal(unauthorized.status, 401);

        const keyword = {
            guildId: '12345678901234567',
            channelId: '22345678901234567',
            trigger: '黒猫',
            responses: ['にゃー']
        };
        const saved = await fetch(`${baseUrl}/v1/keywords/save`, { method: 'POST', headers, body: JSON.stringify(keyword) });
        assert.equal(saved.status, 200);

        const resolved = await fetch(`${baseUrl}/v1/keywords/resolve`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ guildId: keyword.guildId, channelId: keyword.channelId, content: '黒猫です' })
        });
        assert.equal(resolved.status, 200);
        assert.deepEqual(await resolved.json(), { match: { trigger: '黒猫', response: 'にゃー' } });
    } finally {
        await new Promise<void>((resolve) => {
            server.close((): void => {
                resolve();
            });
        });
    }
});
