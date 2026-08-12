import type { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

import type { CommandCatalog } from '../../../application/help/CommandCatalog.js';
import type { DiscordEmbedUser } from '../presentation/DiscordEmbedFactory.js';
import { HelpComponents } from './HelpComponents.js';
import { HelpPresenter } from './HelpPresenter.js';

export interface HelpAutocompleteInteraction {
    focusedOptionName: string;
    focusedValue: string;
    respond: (choices: readonly { name: string; value: string }[]) => Promise<void>;
}

export interface HelpCommandInteraction {
    user: DiscordEmbedUser;
    commandName: string | null;
    memberHasPermissions: (permissions: bigint) => boolean;
    botHasPermissions: (permissions: bigint) => boolean;
    editReply: (embed: EmbedBuilder, components?: ActionRowBuilder<StringSelectMenuBuilder>[]) => Promise<void>;
}

export class HelpController {
    public constructor(
        private readonly catalog: CommandCatalog,
        private readonly presenter: HelpPresenter,
        private readonly components: HelpComponents
    ) {}

    public async autocomplete(interaction: HelpAutocompleteInteraction): Promise<void> {
        if (interaction.focusedOptionName !== 'command_name') return;
        const choices = this.catalog
            .names()
            .filter((choice) => choice.startsWith(interaction.focusedValue))
            .map((choice) => ({ name: choice, value: choice }))
            .slice(0, 25);
        await interaction.respond(choices);
    }

    public async show(interaction: HelpCommandInteraction): Promise<void> {
        if (interaction.commandName) {
            const command = this.catalog.find(interaction.commandName);
            const embed = command
                ? this.presenter.command(
                      interaction.user,
                      command,
                      interaction.memberHasPermissions(command.defaultMemberPermissions),
                      interaction.botHasPermissions(command.defaultBotPermissions)
                  )
                : this.presenter.error(interaction.user, `コマンド \`${interaction.commandName}\` は見つかりませんでした。`);
            await interaction.editReply(embed);
            return;
        }

        await interaction.editReply(this.presenter.home(interaction.user, this.catalog.categories()), await this.components.create());
    }
}
