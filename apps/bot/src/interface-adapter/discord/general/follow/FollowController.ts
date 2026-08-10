import { FollowAnnouncement } from '../../../../application/general/follow/FollowAnnouncement.js';
import { FollowPresenter } from './FollowPresenter.js';

export interface FollowInteraction {
    destinationChannelId: string | undefined;
    editReply: (content: string) => Promise<void>;
}

export class FollowController {
    public constructor(
        private readonly followAnnouncement: FollowAnnouncement,
        private readonly presenter: FollowPresenter
    ) {}

    public async execute(interaction: FollowInteraction): Promise<void> {
        const content = this.presenter.content(await this.followAnnouncement.execute(interaction.destinationChannelId));
        if (content !== undefined) await interaction.editReply(content);
    }
}
