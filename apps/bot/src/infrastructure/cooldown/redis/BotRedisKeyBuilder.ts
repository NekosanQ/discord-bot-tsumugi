import { Buffer } from 'node:buffer';

import type { CooldownKey } from '../../../application/cooldown/CooldownStore.js';

export class BotRedisKeyBuilder {
    public constructor(private readonly environment: string) {
        if (!/^[a-z0-9-]+$/i.test(environment)) throw new TypeError('Redis namespaceのenvironmentが不正です。');
    }

    public cooldown(key: CooldownKey): string {
        const command = Buffer.from(key.commandKey, 'utf8').toString('base64url');
        return `tsumugi:bot:v1:${this.environment}:cooldown:${command}:${key.userId}`;
    }
}
