/**
 * bigint型で渡された権限を日本語の配列に変換するクラス
 */
export class PermissionTranslator {
    private static permissionFlags: Record<string, bigint> = {
        createInstantInvite: 1n << 0n,
        kickMembers: 1n << 1n,
        banMembers: 1n << 2n,
        administrator: 1n << 3n,
        manageChannels: 1n << 4n,
        manageGuild: 1n << 5n,
        addReactions: 1n << 6n,
        viewAuditLog: 1n << 7n,
        prioritySpeaker: 1n << 8n,
        stream: 1n << 9n,
        viewChannel: 1n << 10n,
        sendMessages: 1n << 11n,
        sendTtsMessages: 1n << 12n,
        manageMessages: 1n << 13n,
        embedLinks: 1n << 14n,
        attachFiles: 1n << 15n,
        readMessageHistory: 1n << 16n,
        mentionEveryone: 1n << 17n,
        useExternalEmojis: 1n << 18n,
        viewGuildInsights: 1n << 19n,
        connect: 1n << 20n,
        speak: 1n << 21n,
        muteMembers: 1n << 22n,
        deafenMembers: 1n << 23n,
        moveMembers: 1n << 24n,
        useVad: 1n << 25n,
        changeNickname: 1n << 26n,
        manageNicknames: 1n << 27n,
        manageRoles: 1n << 28n,
        manageWebhooks: 1n << 29n,
        manageEmojisAndStickers: 1n << 30n,
        useApplicationCommands: 1n << 31n,
        requestToSpeak: 1n << 32n,
        manageThreads: 1n << 34n,
        usePublicThreads: 1n << 35n,
        usePrivateThreads: 1n << 36n,
        useExternalStickers: 1n << 37n,
        sendMessagesInThreads: 1n << 38n,
        startEmbeddedActivities: 1n << 39n,
        moderateMembers: 1n << 40n
    };

    private static permissionMapJp: Record<string, string> = {
        createInstantInvite: 'インスタント招待の作成',
        kickMembers: 'メンバーのキック',
        banMembers: 'メンバーのBAN',
        administrator: '管理者',
        manageChannels: 'チャンネルの管理',
        manageGuild: 'サーバーの管理',
        addReactions: 'リアクションの追加',
        viewAuditLog: '監査ログの閲覧',
        prioritySpeaker: '優先スピーカー',
        stream: 'ストリーム',
        viewChannel: 'チャンネルの閲覧',
        sendMessages: 'メッセージの送信',
        sendTtsMessages: 'TTSメッセージの送信',
        manageMessages: 'メッセージの管理',
        embedLinks: 'リンクの埋め込み',
        attachFiles: 'ファイルの添付',
        readMessageHistory: 'メッセージ履歴の閲覧',
        mentionEveryone: 'everyoneのメンション',
        useExternalEmojis: '外部の絵文字の使用',
        viewGuildInsights: 'サーバーのインサイトの閲覧',
        connect: '接続',
        speak: '発言',
        muteMembers: 'メンバーのミュート',
        deafenMembers: 'メンバーのスピーカーミュート',
        moveMembers: 'メンバーの移動',
        useVad: '音声アクティビティの使用',
        changeNickname: 'ニックネームの変更',
        manageNicknames: 'ニックネームの管理',
        manageRoles: 'ロールの管理',
        manageWebhooks: 'Webhookの管理',
        manageEmojisAndStickers: '絵文字とステッカーの管理',
        useApplicationCommands: 'アプリケーションコマンドの使用',
        requestToSpeak: '発言のリクエスト',
        manageThreads: 'スレッドの管理',
        usePublicThreads: '公開スレッドの使用',
        usePrivateThreads: 'プライベートスレッドの使用',
        useExternalStickers: '外部のステッカーの使用',
        sendMessagesInThreads: 'スレッドでのメッセージ送信',
        startEmbeddedActivities: '埋め込みアクティビティの開始',
        moderateMembers: 'メンバーのモデレーション'
    };

    private bitfield: bigint | undefined;
    public permissionNames: string[];

    public constructor(bitfield: bigint | undefined) {
        this.bitfield = bitfield;
        this.permissionNames = this.bitfield !== undefined ? this.getPermissions() : [];
    }

    private getPermissions(): string[] {
        if (this.bitfield === undefined) {
            return [];
        }
        return Object.keys(PermissionTranslator.permissionFlags)
            .filter((flag) => (this.bitfield ?? 0n) & PermissionTranslator.permissionFlags[flag])
            .map((flag) => PermissionTranslator.permissionMapJp[flag]);
    }
}
