import { KeywordValidationError } from './KeywordErrors.js';

const discordSnowflakePattern = /^\d{17,20}$/;
const discordMentionPattern = /<@!?&?\d{17,20}>|@everyone|@here/i;
const discordTokenPatterns = [/[a-z0-9_-]{23,28}\.[a-z0-9_-]{6,7}\.[a-z0-9_-]{27}/i, /mfa\.[a-z0-9_-]{20,}/i];

export const keywordConstraints = {
    triggerMaxLength: 100,
    responsesTextMaxLength: 1000
} as const;

export interface Keyword {
    readonly guildId: string;
    readonly channelId: string;
    readonly trigger: string;
    readonly responses: readonly string[];
}

export interface CreateKeywordInput {
    guildId: string;
    channelId: string;
    trigger: string;
    responses: readonly string[];
}

function validateSnowflake(value: string, field: 'guildId' | 'channelId'): void {
    if (!discordSnowflakePattern.test(value)) {
        throw new KeywordValidationError(field, `${field}はDiscord snowflake形式である必要があります。`);
    }
}

export function parseResponsesText(value: string): string[] {
    if (value.length === 0 || value.length > keywordConstraints.responsesTextMaxLength) {
        throw new KeywordValidationError('responses', '応答メッセージは1文字以上1000文字以下である必要があります。');
    }

    return value.split('\n').filter((line) => line.trim() !== '');
}

export function createKeyword(input: CreateKeywordInput): Keyword {
    validateSnowflake(input.guildId, 'guildId');
    validateSnowflake(input.channelId, 'channelId');

    if (input.trigger.length === 0 || input.trigger.length > keywordConstraints.triggerMaxLength) {
        throw new KeywordValidationError('trigger', 'キーワードは1文字以上100文字以下である必要があります。');
    }
    if (input.responses.length === 0) {
        throw new KeywordValidationError('responses', '応答メッセージを1件以上指定してください。');
    }

    for (const response of input.responses) {
        if (response.trim() === '') {
            throw new KeywordValidationError('responses', '空の応答メッセージは指定できません。');
        }
        if (discordMentionPattern.test(response)) {
            throw new KeywordValidationError('responses', '応答メッセージにメンションを含めることはできません。');
        }
        if (discordTokenPatterns.some((pattern) => pattern.test(response))) {
            throw new KeywordValidationError('responses', '応答メッセージに機密情報と疑われる文字列が含まれています。');
        }
    }

    return Object.freeze({
        guildId: input.guildId,
        channelId: input.channelId,
        trigger: input.trigger,
        responses: Object.freeze([...input.responses])
    });
}
