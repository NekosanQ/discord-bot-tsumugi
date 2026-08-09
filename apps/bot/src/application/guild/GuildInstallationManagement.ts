export interface GuildInstallationManagement {
    setInstallation: (guildId: string, installed: boolean) => Promise<void>;
}
