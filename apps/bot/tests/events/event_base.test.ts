import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from 'discord.js';

import { EventBase } from '../../src/events/base/event_base.js';

class WarnEvent extends EventBase<'warn'> {
    public eventName = 'warn' as const;
    public readonly messages: string[] = [];

    public constructor(private readonly listenerCompletion: Promise<void> = Promise.resolve()) {
        super();
    }

    protected listener(message: string): Promise<void> {
        this.messages.push(message);
        return this.listenerCompletion;
    }
}

void test('eventは再登録で重複せず、unregister後はlistenerを呼ばない', async (): Promise<void> => {
    const client = new Client({ intents: [] });
    const event = new WarnEvent();

    event.register(client);
    event.register(client);
    client.emit('warn', 'registered');
    assert.deepEqual(event.messages, ['registered']);

    event.unregister();
    event.unregister();
    client.emit('warn', 'unregistered');
    assert.deepEqual(event.messages, ['registered']);

    await client.destroy();
});

void test('waitForIdleは実行中listenerの完了を待つ', async (): Promise<void> => {
    let resolveListener: (() => void) | undefined;
    const listenerCompletion = new Promise<void>((resolve) => {
        resolveListener = resolve;
    });
    const client = new Client({ intents: [] });
    const event = new WarnEvent(listenerCompletion);

    event.register(client);
    client.emit('warn', 'in-flight');

    let drained = false;
    const drainPromise = event.waitForIdle();
    void drainPromise.then((): void => {
        drained = true;
    });
    await new Promise<void>((resolve) => {
        setImmediate(resolve);
    });
    assert.equal(drained, false);
    assert.ok(resolveListener);

    resolveListener();
    await drainPromise;
    assert.equal(drained, true);

    event.unregister();
    await client.destroy();
});
