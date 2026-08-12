import type { CommandCatalog } from '../../../../application/help/CommandCatalog.js';
import { HelpPresenter } from '../HelpPresenter.js';
import type { HelpOperation, HelpOperationInteraction } from './HelpOperation.js';

export class HomeOperation implements HelpOperation {
    public constructor(
        private readonly catalog: CommandCatalog,
        private readonly presenter: HelpPresenter
    ) {}

    public async execute(interaction: HelpOperationInteraction): Promise<void> {
        await interaction.editEmbed(this.presenter.home(interaction.user, this.catalog.categories()));
    }
}
