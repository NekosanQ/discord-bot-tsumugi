import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

import { AutocompleteCommandInteraction } from '../../../commands/base/command_base.js';
import CustomSlashCommandBuilder from '../../../utils/CustomSlashCommandBuilder.js';
import { HelpController } from './HelpController.js';

/** Discord入力をHelp controllerのprimitive DTOへ変換する。 */
export class HelpCommand extends AutocompleteCommandInteraction {
    public command = new CustomSlashCommandBuilder()
        .setName('help')
        .setDescription('Botのヘルプを表示します')
        .setCategory('一般')
        .setCooldown(5)
        .setUsage('`/help`, `/help ping`')
        .addStringOption((option) =>
            option.setName('command_name').setDescription('指定したコマンドの詳細情報を表示します。').setAutocomplete(true)
        ) as CustomSlashCommandBuilder;

    public constructor(private readonly controller: HelpController) {
        super();
    }

    protected async onAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focusedOption = interaction.options.getFocused(true);
        await this.controller.autocomplete({
            focusedOptionName: focusedOption.name,
            focusedValue: focusedOption.value,
            respond: async (choices): Promise<void> => {
                await interaction.respond([...choices]);
            }
        });
    }

    protected async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        await this.controller.show({
            user: interaction.user,
            commandName: interaction.options.getString('command_name'),
            memberHasPermissions: (permissions): boolean => interaction.memberPermissions?.has(permissions) ?? false,
            botHasPermissions: (permissions): boolean => interaction.guild?.members.me?.permissions.has(permissions) ?? false,
            editReply: async (embed, components): Promise<void> => {
                await interaction.editReply({ embeds: [embed], ...(components ? { components } : {}) });
            }
        });
    }
}
