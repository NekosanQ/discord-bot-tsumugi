import { HelpPresenter } from '../HelpPresenter.js';
import type { HelpOperation, HelpOperationInteraction } from './HelpOperation.js';

export class GuideOperation implements HelpOperation {
    public constructor(private readonly presenter: HelpPresenter) {}

    public async execute(interaction: HelpOperationInteraction): Promise<void> {
        await interaction.editEmbed(this.presenter.guide(interaction.user));
    }
}
