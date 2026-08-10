import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canManageGuild, type DiscordGuildMembership, normalizeDashboardReturnTo } from '../../../src/domain/dashboard/DashboardTypes.js';

void describe('dashboard authorization domain', (): void => {
    const membership = (permissions: string, owner = false): DiscordGuildMembership => ({
        id: '12345678901234567',
        name: 'guild',
        iconHash: null,
        owner,
        permissions
    });

    void it('owner、Administrator、Manage Guildだけを管理可能とする', (): void => {
        assert.equal(canManageGuild(membership('0', true)), true);
        assert.equal(canManageGuild(membership(String(1n << 3n))), true);
        assert.equal(canManageGuild(membership(String(1n << 5n))), true);
        assert.equal(canManageGuild(membership(String(1n << 10n))), false);
        assert.equal(canManageGuild(membership('invalid')), false);
    });

    void it('returnToをdashboard配下だけに制限する', (): void => {
        assert.equal(normalizeDashboardReturnTo('/dashboard/123'), '/dashboard/123');
        assert.equal(normalizeDashboardReturnTo('https://evil.example/'), '/dashboard');
        assert.equal(normalizeDashboardReturnTo('//evil.example/dashboard'), '/dashboard');
        assert.equal(normalizeDashboardReturnTo('/dashboard\\evil'), '/dashboard');
    });
});
