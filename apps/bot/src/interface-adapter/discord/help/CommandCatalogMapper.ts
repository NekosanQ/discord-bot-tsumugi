import type { CommandHelpEntry } from '../../../application/help/CommandCatalog.js';
import { CommandGroupInteraction, CommandInteraction, SubCommandInteraction } from '../../../commands/base/command_base.js';
import type { InteractionBase } from '../../../commands/base/interaction_base.js';

function categoryOf(command: CommandInteraction | SubCommandInteraction): string | undefined {
    if (typeof command.command.category === 'string') return command.command.category;
    if (command instanceof SubCommandInteraction && command.registry instanceof CommandGroupInteraction) {
        const parentCommand = command.registry.command;
        if ('category' in parentCommand && typeof parentCommand.category === 'string') return parentCommand.category;
    }
    return undefined;
}

function lookupNameOf(command: CommandInteraction | SubCommandInteraction): string {
    if (command instanceof SubCommandInteraction && command.registry instanceof CommandGroupInteraction) {
        return `${command.registry.command.name} ${command.command.name}`;
    }
    return command.command.name;
}

function memberPermissionsOf(command: CommandInteraction | SubCommandInteraction): bigint {
    if (command instanceof SubCommandInteraction) {
        const parentCommand = command.registry.command;
        return BigInt('default_member_permissions' in parentCommand ? (parentCommand.default_member_permissions ?? 0) : 0);
    }
    return BigInt(command.command.default_member_permissions ?? 0);
}

/** Discord command builderをapplication用のprimitiveなHelp DTOへ写す。 */
export function mapCommandCatalogEntries(interactions: readonly InteractionBase[]): CommandHelpEntry[] {
    const entries: CommandHelpEntry[] = [];
    for (const interaction of interactions) {
        if (!(interaction instanceof CommandInteraction || interaction instanceof SubCommandInteraction)) continue;
        const category = categoryOf(interaction);
        if (!category) continue;

        entries.push({
            lookupName: lookupNameOf(interaction),
            name: interaction.command.name,
            description: interaction.command.description,
            category,
            displayCategory: typeof interaction.command.category === 'string' ? interaction.command.category : undefined,
            usage: interaction.command.usage,
            cooldownSeconds: interaction.command.cooldown,
            defaultMemberPermissions: memberPermissionsOf(interaction),
            defaultBotPermissions: BigInt(interaction.command.defaultBotPermissions ?? 0)
        });
    }
    return entries;
}
