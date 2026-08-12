import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EmptyState } from '../../src/app/_components/EmptyState.js';
import { SafeAvatar, safeDiscordCdnUrl } from '../../src/app/_components/SafeAvatar.js';

void test('empty stateは見出しと説明を意味のあるHTMLで表示する', (): void => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: '空です', description: '最初の項目を追加してください。' }));
    assert.match(html, /<section[^>]*aria-live="polite"/);
    assert.match(html, /<h2>空です<\/h2>/);
    assert.match(html, /最初の項目を追加してください。/);
});

void test('avatarはDiscord CDN以外のURLを読み込まない', (): void => {
    assert.equal(safeDiscordCdnUrl('https://cdn.discordapp.com/avatars/1/hash.png'), 'https://cdn.discordapp.com/avatars/1/hash.png');
    assert.equal(safeDiscordCdnUrl('https://evil.example/avatar.png'), undefined);
    const html = renderToStaticMarkup(createElement(SafeAvatar, { className: 'avatar', name: 'Tsumugi', url: 'https://evil.example/x.png' }));
    assert.doesNotMatch(html, /evil\.example/);
    assert.match(html, />T<\/span>/);
});
