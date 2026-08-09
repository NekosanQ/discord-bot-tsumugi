import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

void test('entrypointは隔離processでimportしても環境読込・signal登録・起動を行わない', async (): Promise<void> => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tsumugi-import-'));

    try {
        const childEnvironment = { ...process.env };
        childEnvironment.APP_BASEDIR = temporaryDirectory;
        childEnvironment.DATABASE_URL = '';
        childEnvironment.DISCORD_TOKEN = '';
        childEnvironment.DOTENV_CONFIG_PATH = path.join(temporaryDirectory, 'does-not-exist.env');
        childEnvironment.NODE_ENV = 'import-only-does-not-exist';

        const script = [
            "const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]",
            "await import('./src/index.ts')",
            "const after = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]",
            "if (before[0] !== after[0] || before[1] !== after[1]) throw new Error('signal listeners changed')"
        ].join(';');
        const result = await execFileAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: childEnvironment,
            timeout: 5_000,
            windowsHide: true
        });

        assert.equal(result.stdout, '');
        assert.equal(result.stderr, '');
        assert.deepEqual(await readdir(temporaryDirectory), []);
    } finally {
        await rm(temporaryDirectory, { force: true, recursive: true });
    }
});
