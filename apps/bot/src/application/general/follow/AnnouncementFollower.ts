export interface AnnouncementFollower {
    follow: (destinationChannelId: string) => Promise<boolean>;
}
