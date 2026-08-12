import assert from 'node:assert/strict';
import test from 'node:test';

import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

import {
    AutocompleteCommandInteraction,
    CommandGroupInteraction,
    CommandInteraction,
    SubCommandInteraction
} from '../../../../src/commands/base/command_base.js';
import { mapCommandCatalogEntries } from '../../../../src/interface-adapter/discord/help/CommandCatalogMapper.js';
import CustomSlashCommandBuilder from '../../../../src/utils/CustomSlashCommandBuilder.js';
import CustomSlashSubcommandBuilder from '../../../../src/utils/CustomSlashSubCommandBuilder.js';

class CatalogCommand extends CommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('ping')
        .setDescription('Ping')
        .setCategory('一般')
        .setUsage('/ping')
        .setCooldown(5)
        .setDefaultMemberPermissions(16n)
        .setDefaultBotPermissions(8n);

    protected onCommand(_interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}

class CatalogCommandGroup extends CommandGroupInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('keyword')
        .setDescription('Keyword')
        .setCategory('キーワード応答機能')
        .setDefaultMemberPermissions(32n);
}

class CatalogSubCommand extends SubCommandInteraction {
    public command = new CustomSlashSubcommandBuilder()
        .setName('add')
        .setDescription('Add keyword')
        .setUsage('/keyword add')
        .setDefaultBotPermissions(64n);

    public onCommand(_interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}

class CatalogAutocompleteCommand extends AutocompleteCommandInteraction {
    public command = new CustomSlashCommandBuilder().setName('help').setDescription('Help').setCategory('一般');

    protected onCommand(_interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    protected onAutocomplete(_interaction: AutocompleteInteraction): Promise<void> {
        return Promise.resolve();
    }
}

void test('mapperは実行可能commandとsubcommandだけをprimitiveなcatalog entryへ変換する', (): void => {
    const group = new CatalogCommandGroup();
    const entries = mapCommandCatalogEntries([new CatalogCommand(), group, new CatalogSubCommand(group), new CatalogAutocompleteCommand()]);

    assert.deepEqual(entries, [
        {
            lookupName: 'ping',
            name: 'ping',
            description: 'Ping',
            category: '一般',
            displayCategory: '一般',
            usage: '/ping',
            cooldownSeconds: 5,
            defaultMemberPermissions: 16n,
            defaultBotPermissions: 8n
        },
        {
            lookupName: 'keyword add',
            name: 'add',
            description: 'Add keyword',
            category: 'キーワード応答機能',
            displayCategory: undefined,
            usage: '/keyword add',
            cooldownSeconds: undefined,
            defaultMemberPermissions: 32n,
            defaultBotPermissions: 64n
        }
    ]);
});
