import type { AnnouncementFollower } from './AnnouncementFollower.js';

export type FollowAnnouncementResult = 'followed' | 'announcement-not-found' | 'destination-not-found';

export class FollowAnnouncement {
    public constructor(private readonly follower: AnnouncementFollower) {}

    public async execute(destinationChannelId: string | undefined): Promise<FollowAnnouncementResult> {
        if (!destinationChannelId) return 'destination-not-found';
        return (await this.follower.follow(destinationChannelId)) ? 'followed' : 'announcement-not-found';
    }
}
