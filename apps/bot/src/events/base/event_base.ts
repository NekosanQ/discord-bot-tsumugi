import { Client, ClientEvents } from 'discord.js';

import { logger } from '../../utils/log.js';

/**
 * イベントベースの抽象クラス
 */
export abstract class EventBase<K extends keyof ClientEvents> {
    private registeredClient: Client | undefined;
    private registeredListener: ((...args: ClientEvents[K]) => void) | undefined;
    private readonly inFlightListeners = new Set<Promise<void>>();

    /**
     * イベント名
     */
    protected abstract eventName: K;

    /**
     * イベントリスナー
     * @param args イベント引数
     */
    protected abstract listener(...args: ClientEvents[K]): Promise<void>;

    /**
     * イベントを登録する関数
     * @param client Discordクライアント
     */
    public register(client: Client): void {
        this.unregister();

        const registeredListener = (...args: ClientEvents[K]): void => {
            const inFlight = this.listener(...args);
            this.inFlightListeners.add(inFlight);
            void inFlight.then(
                (): void => {
                    this.inFlightListeners.delete(inFlight);
                },
                (error: unknown): void => {
                    this.inFlightListeners.delete(inFlight);
                    logger.error(`Discord event(${this.eventName})の処理中にエラーが発生しました。`, error);
                }
            );
        };

        this.registeredClient = client;
        this.registeredListener = registeredListener;
        client.on(this.eventName, registeredListener);
    }

    /** 登録済みのlistenerを解除する */
    public unregister(): void {
        if (!this.registeredClient || !this.registeredListener) return;

        this.registeredClient.off(this.eventName, this.registeredListener);
        this.registeredClient = undefined;
        this.registeredListener = undefined;
    }

    /** 登録解除前に開始していたlistenerがすべて完了するまで待つ */
    public async waitForIdle(): Promise<void> {
        while (this.inFlightListeners.size > 0) {
            await Promise.allSettled([...this.inFlightListeners]);
        }
    }
}
