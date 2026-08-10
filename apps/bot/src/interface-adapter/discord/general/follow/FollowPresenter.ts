import type { FollowAnnouncementResult } from '../../../../application/general/follow/FollowAnnouncement.js';

export class FollowPresenter {
    public content(result: FollowAnnouncementResult): string | undefined {
        if (result === 'followed') return 'Botからのお知らせをフォローしました';
        if (result === 'announcement-not-found') return 'Botからのお知らせチャンネルが見つかりませんでした';
        return undefined;
    }
}
