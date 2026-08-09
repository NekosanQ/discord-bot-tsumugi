import type { KeywordScope } from '../../../../application/keyword/KeywordRepository.js';

export class ApiRedisKeyBuilder {
    public constructor(private readonly environment: string) {
        if (!/^[a-z0-9-]+$/i.test(environment)) throw new TypeError('Redis namespaceのenvironmentが不正です。');
    }

    public keywordList(scope: KeywordScope): string {
        return `tsumugi:api:v1:${this.environment}:keyword-list:${scope.guildId}:${scope.channelId}`;
    }
}
