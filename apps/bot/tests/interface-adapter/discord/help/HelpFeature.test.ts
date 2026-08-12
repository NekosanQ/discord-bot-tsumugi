import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmbedBuilder } from 'discord.js';

import type { CommandHelpEntry } from '../../../../src/application/help/CommandCatalog.js';
import { ImmutableCommandCatalog } from '../../../../src/application/help/ImmutableCommandCatalog.js';
import { HelpCategoryMenuAction } from '../../../../src/interface-adapter/discord/help/HelpCategoryMenuAction.js';
import { HelpComponents } from '../../../../src/interface-adapter/discord/help/HelpComponents.js';
import { HelpController } from '../../../../src/interface-adapter/discord/help/HelpController.js';
import { HelpOperationMenuAction } from '../../../../src/interface-adapter/discord/help/HelpOperationMenuAction.js';
import { HelpPresenter } from '../../../../src/interface-adapter/discord/help/HelpPresenter.js';
import { DeleteOperation } from '../../../../src/interface-adapter/discord/help/operations/DeleteOperation.js';
import { FixationOperation } from '../../../../src/interface-adapter/discord/help/operations/FixationOperation.js';
import { GuideOperation } from '../../../../src/interface-adapter/discord/help/operations/GuideOperation.js';
import type { HelpOperation } from '../../../../src/interface-adapter/discord/help/operations/HelpOperation.js';
import { HomeOperation } from '../../../../src/interface-adapter/discord/help/operations/HomeOperation.js';
import { DiscordEmbedFactory } from '../../../../src/interface-adapter/discord/presentation/DiscordEmbedFactory.js';

const user = { displayName: '実行者', displayAvatarURL: (): string => 'https://example.com/avatar.png' };

function commandEntry(lookupName: string, category = '一般'): CommandHelpEntry {
    const nameParts = lookupName.split(' ');
    return {
        lookupName,
        name: nameParts.at(-1) ?? lookupName,
        description: `${lookupName}の説明`,
        category,
        displayCategory: lookupName.includes(' ') ? undefined : category,
        usage: `/${lookupName}`,
        cooldownSeconds: 5,
        defaultMemberPermissions: 32n,
        defaultBotPermissions: 16n
    };
}

function createHelpFeature(catalog: ImmutableCommandCatalog): {
    controller: HelpController;
    categoryAction: HelpCategoryMenuAction;
    operationAction: HelpOperationMenuAction;
} {
    const presenter = new HelpPresenter(new DiscordEmbedFactory({ botColor: '0', errorColor: '1', errorEmoji: '⚠️' }), {
        iconUrl: 'https://example.com/icon.png',
        inviteUrl: 'https://example.com/invite',
        supportGuildUrl: 'https://example.com/support'
    });
    const categoryAction = new HelpCategoryMenuAction(catalog, presenter);
    const operations = new Map<string, HelpOperation>([
        ['home', new HomeOperation(catalog, presenter)],
        ['fixation', new FixationOperation()],
        ['delete', new DeleteOperation()],
        ['guide', new GuideOperation(presenter)]
    ]);
    const operationAction = new HelpOperationMenuAction(operations);
    return {
        controller: new HelpController(catalog, presenter, new HelpComponents(categoryAction, operationAction)),
        categoryAction,
        operationAction
    };
}

void test('autocompleteは注入されたlocal catalogだけを参照して前方一致する', async (): Promise<void> => {
    const first = createHelpFeature(new ImmutableCommandCatalog([commandEntry('ping')]));
    const second = createHelpFeature(new ImmutableCommandCatalog([commandEntry('guild')]));
    const firstResponses: { name: string; value: string }[][] = [];
    const secondResponses: { name: string; value: string }[][] = [];

    await first.controller.autocomplete({
        focusedOptionName: 'command_name',
        focusedValue: '',
        respond: (choices): Promise<void> => {
            firstResponses.push([...choices]);
            return Promise.resolve();
        }
    });
    await second.controller.autocomplete({
        focusedOptionName: 'command_name',
        focusedValue: '',
        respond: (choices): Promise<void> => {
            secondResponses.push([...choices]);
            return Promise.resolve();
        }
    });

    assert.deepEqual(firstResponses, [[{ name: 'ping', value: 'ping' }]]);
    assert.deepEqual(secondResponses, [[{ name: 'guild', value: 'guild' }]]);
});

void test('command詳細はcatalogの権限値をfake interactionへ問い合わせて既存表示へ変換する', async (): Promise<void> => {
    const feature = createHelpFeature(new ImmutableCommandCatalog([commandEntry('keyword add', 'キーワード応答機能')]));
    const permissionChecks: bigint[] = [];
    let embed: EmbedBuilder | undefined;

    await feature.controller.show({
        user,
        commandName: 'keyword add',
        memberHasPermissions: (permissions): boolean => {
            permissionChecks.push(permissions);
            return true;
        },
        botHasPermissions: (permissions): boolean => {
            permissionChecks.push(permissions);
            return false;
        },
        editReply: (createdEmbed): Promise<void> => {
            embed = createdEmbed;
            return Promise.resolve();
        }
    });

    assert.ok(embed);
    const json = embed.toJSON();
    const fields = json.fields ?? [];
    assert.deepEqual(permissionChecks, [32n, 16n]);
    assert.equal(json.author?.name, '猫咲 紬 - コマンド詳細 [add]');
    assert.equal(fields.find((field) => field.name === 'カテゴリー')?.value, '未分類');
    assert.equal(fields.find((field) => field.name === '実行可能か')?.value, 'いいえ');
});

void test('home表示はカテゴリ一覧と2つの既存select menuを返す', async (): Promise<void> => {
    const feature = createHelpFeature(new ImmutableCommandCatalog([commandEntry('ping'), commandEntry('keyword add', 'キーワード応答機能')]));
    let embed: EmbedBuilder | undefined;
    let componentCount = 0;

    await feature.controller.show({
        user,
        commandName: null,
        memberHasPermissions: (): boolean => true,
        botHasPermissions: (): boolean => true,
        editReply: (createdEmbed, components): Promise<void> => {
            embed = createdEmbed;
            componentCount = components?.length ?? 0;
            return Promise.resolve();
        }
    });

    assert.ok(embed);
    const homeJson = embed.toJSON();
    const categoryField = homeJson.fields?.[0];
    assert.ok(categoryField);
    assert.equal(homeJson.author?.name, '猫咲 紬 - ヘルプ');
    assert.match(categoryField.value, /1ページ目: 一般\n2ページ目: キーワード応答機能/);
    assert.equal(componentCount, 2);
});

void test('カテゴリ選択は該当ページを表示し、不明カテゴリではcomponentsを除去する', async (): Promise<void> => {
    const feature = createHelpFeature(new ImmutableCommandCatalog([commandEntry('ping')]));
    const updates: { author: string | undefined; clearComponents: boolean }[] = [];
    const update = (embed: EmbedBuilder, clearComponents: boolean): Promise<void> => {
        updates.push({ author: embed.toJSON().author?.name, clearComponents });
        return Promise.resolve();
    };

    await feature.categoryAction.select({ user, selectedCategory: '一般', update });
    await feature.categoryAction.select({ user, selectedCategory: 'unknown', update });

    assert.deepEqual(updates, [
        { author: '猫咲 紬 - 一般', clearComponents: false },
        { author: undefined, clearComponents: true }
    ]);
    assert.equal((await feature.categoryAction.create()).toJSON().custom_id, '_=help_category&_t=3');
});

void test('home・guide・fixation・delete操作を従来どおりdispatchする', async (): Promise<void> => {
    const feature = createHelpFeature(new ImmutableCommandCatalog([commandEntry('ping')]));
    const calls: string[] = [];
    const interaction = {
        user,
        deferUpdate: (): Promise<void> => {
            calls.push('defer');
            return Promise.resolve();
        },
        editEmbed: (embed: EmbedBuilder): Promise<void> => {
            calls.push(`embed:${embed.toJSON().author?.name ?? ''}`);
            return Promise.resolve();
        },
        clearComponents: (): Promise<void> => {
            calls.push('clear');
            return Promise.resolve();
        },
        deleteMessage: (): Promise<void> => {
            calls.push('delete');
            return Promise.resolve();
        }
    };

    await feature.operationAction.operate('home', interaction);
    await feature.operationAction.operate('guide', interaction);
    await feature.operationAction.operate('fixation', interaction);
    await feature.operationAction.operate('delete', interaction);

    assert.deepEqual(calls, ['defer', 'embed:猫咲 紬 - ヘルプ', 'defer', 'embed:猫咲 紬 - コマンドガイド', 'defer', 'clear', 'defer', 'delete']);
    assert.deepEqual(
        (await feature.operationAction.create()).toJSON().options.map((option) => option.value),
        ['home', 'fixation', 'delete', 'guide']
    );
});
