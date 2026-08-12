import type { HelpOperation, HelpOperationInteraction } from './HelpOperation.js';

export class DeleteOperation implements HelpOperation {
    public async execute(interaction: HelpOperationInteraction): Promise<void> {
        await interaction.deleteMessage();
    }
}
