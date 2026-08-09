import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { ConfigLoadError, loadConfig } from '../../src/utils/config.js';

const validConfig = `
clientId = "client"
guildId = "guild"
botColor = "1"
errorColor = "2"
iconURL = "https://example.com/icon.png"
inviteURL = "https://example.com/invite"
announcementChannelId = "announcement"
botEntranceChannelId = "entrance"
supportGuildURL = "https://example.com/support"
errorEmoji = "error"
botEmoji = "bot"
memberEmoji = "member"
emoji = "emoji"
gifEmoji = "gif"

[statusEmoji]
online = "online"
idle = "idle"
dnd = "dnd"
streaming = "streaming"
invisible = "invisible"

[channelEmoji]
publicText = "publicText"
lockedText = "lockedText"
publicVoice = "publicVoice"
lockedVoice = "lockedVoice"
publicAnnouncement = "publicAnnouncement"
lockedAnnouncement = "lockedAnnouncement"
publicStage = "publicStage"
lockedStage = "lockedStage"
category = "category"
`;

void test('loadConfigは全必須項目を検証して指定環境のTOMLを返す', (): void => {
    let loadedPath = '';
    const loaded = loadConfig({
        environment: 'test',
        baseDirectory: 'workspace',
        readFile: (filePath: string): string => {
            loadedPath = filePath;
            return validConfig;
        }
    });

    assert.equal(loaded.guildId, 'guild');
    assert.equal(loaded.statusEmoji.online, 'online');
    assert.equal(loadedPath.endsWith(path.join('config', 'test.toml')), true);
});

void test('必須項目がないconfigをinvalidとして分類する', (): void => {
    assert.throws(
        () => loadConfig({ environment: 'invalid', readFile: (): string => '' }),
        (error: unknown): boolean => error instanceof ConfigLoadError && error.reason === 'invalid'
    );
});

void test('table内の型が不正なconfigをinvalidとして分類する', (): void => {
    const invalidConfig = validConfig.replace('online = "online"', 'online = 1');

    assert.throws(
        () => loadConfig({ environment: 'invalid', readFile: (): string => invalidConfig }),
        (error: unknown): boolean => error instanceof ConfigLoadError && error.reason === 'invalid'
    );
});

void test('存在しないconfigをnot-foundとして分類する', (): void => {
    const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });

    assert.throws(
        () =>
            loadConfig({
                environment: 'missing',
                readFile: (): string => {
                    throw missingError;
                }
            }),
        (error: unknown): boolean => error instanceof ConfigLoadError && error.reason === 'not-found' && error.cause === missingError
    );
});

void test('壊れたTOMLをinvalidとして分類する', (): void => {
    assert.throws(
        () => loadConfig({ environment: 'invalid', readFile: (): string => 'guildId = [' }),
        (error: unknown): boolean => error instanceof ConfigLoadError && error.reason === 'invalid'
    );
});
