import { Client, ClientEvents } from 'discord.js';

import { EventBase } from './base/event_base.js';

export type AnyEventBase = {
    [K in keyof ClientEvents]: EventBase<K>;
}[keyof ClientEvents];

/**
 * イベントハンドラークラス
 */
export default class EventHandler {
    /**
     * コンストラクタ
     * @param _events イベントリスト
     */
    public constructor(private _events: AnyEventBase[]) {}

    /**
     * イベントを登録する関数
     * @param client Discordクライアント
     */
    public registerEvents(client: Client): void {
        this._events.forEach((event) => {
            event.register(client);
        });
    }

    /** 登録済みの全イベントlistenerを解除する */
    public unregisterEvents(): void {
        this._events.forEach((event) => {
            event.unregister();
        });
    }

    /** 登録解除時点ですでに実行中だったlistenerを待つ */
    public async waitForIdle(): Promise<void> {
        await Promise.all(this._events.map((event): Promise<void> => event.waitForIdle()));
    }
}
