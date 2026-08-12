import assert from 'node:assert/strict';
import test from 'node:test';

import type { CommandHelpEntry } from '../../../src/application/help/CommandCatalog.js';
import { ImmutableCommandCatalog } from '../../../src/application/help/ImmutableCommandCatalog.js';

function entry(name: string, category = '一般'): CommandHelpEntry {
    return {
        lookupName: name,
        name,
        description: `${name} description`,
        category,
        displayCategory: category,
        usage: `/${name}`,
        cooldownSeconds: 5,
        defaultMemberPermissions: 0n,
        defaultBotPermissions: 0n
    };
}

void test('catalogは入力配列から独立したdeep immutable snapshotになる', (): void => {
    const source = [entry('ping')];
    const catalog = new ImmutableCommandCatalog(source);
    source.push(entry('guild'));

    assert.deepEqual(catalog.names(), ['ping']);
    assert.deepEqual(catalog.categories(), [{ category: '一般', commands: [{ name: 'ping', description: 'ping description' }] }]);
    assert.equal(Object.isFrozen(catalog.names()), true);
    assert.equal(Object.isFrozen(catalog.categories()), true);
    assert.equal(Object.isFrozen(catalog.categories()[0].commands), true);
    assert.equal(Object.isFrozen(catalog.find('ping')), true);
});

void test('別々に生成したcatalogのcommandは相互に混入しない', (): void => {
    const first = new ImmutableCommandCatalog([entry('ping')]);
    const second = new ImmutableCommandCatalog([entry('guild'), entry('keyword add', 'キーワード応答機能')]);

    assert.deepEqual(first.names(), ['ping']);
    assert.deepEqual(second.names(), ['guild', 'keyword add']);
    assert.equal(first.find('guild'), undefined);
    assert.equal(second.find('ping'), undefined);
});
