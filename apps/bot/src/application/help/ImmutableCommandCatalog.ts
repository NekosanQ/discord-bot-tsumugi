import type { CommandCatalog, CommandCategory, CommandHelpEntry } from './CommandCatalog.js';

function freezeEntry(entry: CommandHelpEntry): CommandHelpEntry {
    return Object.freeze({ ...entry });
}

/** createCommands呼び出し内だけで所有する、deep immutableなHelp用catalog。 */
export class ImmutableCommandCatalog implements CommandCatalog {
    private readonly entriesByName: ReadonlyMap<string, CommandHelpEntry>;
    private readonly commandNames: readonly string[];
    private readonly commandCategories: readonly CommandCategory[];

    public constructor(entries: readonly CommandHelpEntry[]) {
        const entriesByName = new Map<string, CommandHelpEntry>();
        const commandNames: string[] = [];
        const categoryMap = new Map<string, { name: string; description: string }[]>();

        for (const rawEntry of entries) {
            const entry = freezeEntry(rawEntry);
            entriesByName.set(entry.lookupName, entry);
            if (!commandNames.includes(entry.lookupName)) commandNames.push(entry.lookupName);
            const commands = categoryMap.get(entry.category) ?? [];
            commands.push(Object.freeze({ name: entry.lookupName, description: entry.description }));
            categoryMap.set(entry.category, commands);
        }

        this.entriesByName = entriesByName;
        this.commandNames = Object.freeze(commandNames);
        this.commandCategories = Object.freeze(
            [...categoryMap.entries()].map(([category, commands]) => Object.freeze({ category, commands: Object.freeze(commands) }))
        );
    }

    public find(name: string): CommandHelpEntry | undefined {
        return this.entriesByName.get(name);
    }

    public names(): readonly string[] {
        return this.commandNames;
    }

    public categories(): readonly CommandCategory[] {
        return this.commandCategories;
    }
}
