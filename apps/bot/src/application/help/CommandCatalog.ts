export interface CommandSummary {
    readonly name: string;
    readonly description: string;
}

export interface CommandCategory {
    readonly category: string;
    readonly commands: readonly CommandSummary[];
}

export interface CommandHelpEntry {
    readonly lookupName: string;
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly displayCategory?: string;
    readonly usage?: string;
    readonly cooldownSeconds?: number;
    readonly defaultMemberPermissions: bigint;
    readonly defaultBotPermissions: bigint;
}

export interface CommandCatalog {
    find: (name: string) => CommandHelpEntry | undefined;
    names: () => readonly string[];
    categories: () => readonly CommandCategory[];
}
