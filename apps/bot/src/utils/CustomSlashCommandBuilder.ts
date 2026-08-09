import { SlashCommandBuilder } from 'discord.js';

class CustomSlashCommandBuilder extends SlashCommandBuilder {
    public category?: string;
    public usage?: string;
    public cooldown?: number;
    public defaultBotPermissions?: string;

    public constructor() {
        super();
    }

    public setCooldown(seconds: number): this {
        this.cooldown = seconds;
        if (seconds <= 0) {
            throw new Error('Cooldown must be a positive number');
        }
        return this;
    }

    public setCategory(category: string): this {
        this.category = category;
        return this;
    }

    public setUsage(usage: string): this {
        this.usage = usage;
        return this;
    }

    public setDefaultBotPermissions(permissions: bigint | number | null | undefined): this {
        this.defaultBotPermissions = permissions?.toString();
        return this;
    }
}

export default CustomSlashCommandBuilder;
