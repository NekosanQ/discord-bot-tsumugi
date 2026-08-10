import assert from 'node:assert/strict';
import test from 'node:test';

import { DrawOmikuji } from '../../src/application/fun/omikuji/DrawOmikuji.js';
import { PlayRockPaperScissors } from '../../src/application/fun/rps/PlayRockPaperScissors.js';
import { SpinSlot } from '../../src/application/fun/slot/SpinSlot.js';
import type { KeywordManagement } from '../../src/application/keyword/KeywordManagement.js';
import type { InteractionBase } from '../../src/commands/base/interaction_base.js';
import { createCommands } from '../../src/commands/index.js';

const keywordManagement: KeywordManagement = {
    save: (): Promise<void> => Promise.resolve(),
    remove: (): Promise<void> => Promise.resolve(),
    get: (): Promise<never> => Promise.reject(new Error('not used')),
    list: (): Promise<[]> => Promise.resolve([]),
    resolve: (): Promise<undefined> => Promise.resolve(undefined)
};

function findCommand(commands: InteractionBase[], commandName: string): InteractionBase {
    const command = commands.find((candidate) => candidate.command?.name === commandName);
    assert.ok(command);
    return command;
}

void test('createCommandsはfunコマンドを呼び出しごとに生成する', (): void => {
    const randomSource = { next: (): number => 0 };
    const dependencies = {
        drawOmikuji: new DrawOmikuji(randomSource),
        keywordManagement,
        playRockPaperScissors: new PlayRockPaperScissors(randomSource),
        spinSlot: new SpinSlot(randomSource, { wait: (): Promise<void> => Promise.resolve() })
    };

    const first = createCommands(dependencies);
    const second = createCommands(dependencies);

    for (const commandName of ['omikuji', 'rpc', 'slot']) {
        assert.notStrictEqual(findCommand(first, commandName), findCommand(second, commandName));
    }
});
