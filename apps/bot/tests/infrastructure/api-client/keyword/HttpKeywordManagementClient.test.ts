import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSyncGuildSnapshotRequest } from '@tsumugi/contracts';

import { type HttpFetcher, HttpKeywordManagementClient } from '../../../../src/infrastructure/api-client/keyword/HttpKeywordManagementClient.js';

void test('service tokenと既存timeout付きPUTでguild snapshot contractを送信する', async (): Promise<void> => {
    const requests: { input: URL; init: RequestInit }[] = [];
    const fetcher: HttpFetcher = (input, init): Promise<Response> => {
        requests.push({ input, init });
        return Promise.resolve(new Response(null, { status: 204 }));
    };
    const client = new HttpKeywordManagementClient('https://api.example.test', 'test-service-token', 2500, fetcher);

    await client.sync({
        guildId: '123456789012345678',
        installed: true,
        channels: [
            { id: '223456789012345678', name: 'general', type: 'text' },
            { id: '323456789012345678', name: 'news', type: 'announcement' }
        ]
    });

    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.ok(request);
    assert.equal(request.input.href, 'https://api.example.test/v1/internal/guilds/snapshot');
    assert.equal(request.init.method, 'PUT');
    assert.equal(new Headers(request.init.headers).get('authorization'), 'Bearer test-service-token');
    assert.equal(new Headers(request.init.headers).get('content-type'), 'application/json');
    assert.ok(request.init.signal instanceof AbortSignal);
    if (typeof request.init.body !== 'string') assert.fail('JSON bodyが必要です。');
    assert.deepEqual(parseSyncGuildSnapshotRequest(JSON.parse(request.init.body) as unknown), {
        guildId: '123456789012345678',
        installed: true,
        channels: [
            { id: '223456789012345678', name: 'general', type: 'text' },
            { id: '323456789012345678', name: 'news', type: 'announcement' }
        ]
    });
});
