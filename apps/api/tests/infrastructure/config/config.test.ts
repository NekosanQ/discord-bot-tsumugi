import assert from 'node:assert/strict';
import test from 'node:test';

import { loadApiConfig, loadDashboardEnvironment } from '../../../src/infrastructure/config/config.js';

void test('環境別configがない場合は非秘密のexample設定へfallbackする', () => {
    const config = loadApiConfig(process.cwd(), 'missing-test-environment');
    assert.equal(config.port, 3000);
    assert.equal(config.requestTimeoutMs, 5000);
    assert.equal(config.keywordCache.ttlMs, 60000);
    assert.equal(config.keywordCache.commandTimeoutMs, 250);
    assert.equal(config.dashboard.origin, 'http://localhost:3001');
    assert.equal(config.dashboard.mutationLimit, 30);
});

void test('dashboard秘密情報を環境変数だけから検証する', () => {
    const environment: NodeJS.ProcessEnv = {};
    environment.API_DISCORD_CLIENT_ID = 'client-id';
    environment.API_DISCORD_CLIENT_SECRET = 'client-secret';
    environment.API_DISCORD_REDIRECT_URI = 'http://localhost:3001/auth/callback';
    environment.API_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    environment.API_SESSION_SECRET = Buffer.alloc(32, 2).toString('base64');
    environment.API_WEB_PROXY_TOKEN = 'web-proxy-token-that-is-at-least-32-characters';
    environment.API_SECURITY_REDIS_URL = 'redis://security:6379';
    const value = loadDashboardEnvironment(environment);
    assert.equal(value.clientId, 'client-id');
    assert.equal(value.securityRedisUrl, 'redis://security:6379');
    assert.equal(value.webProxyToken, 'web-proxy-token-that-is-at-least-32-characters');
});

void test('dashboard秘密情報の欠落を起動前に拒否する', () => {
    assert.throws(() => loadDashboardEnvironment({}), /API_DISCORD_REDIRECT_URI/);
});
