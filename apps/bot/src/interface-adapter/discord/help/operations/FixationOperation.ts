import type { HelpOperation, HelpOperationInteraction } from './HelpOperation.js';

export class FixationOperation implements HelpOperation {
    public async execute(interaction: HelpOperationInteraction): Promise<void> {
        await interaction.clearComponents();
    }
}
