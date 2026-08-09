import { join } from 'path';

/** 作業ディレクトリへのパス */
export const workdir = process.env.APP_BASEDIR ?? 'run';

/**
 * 作業ディレクトリからの相対パスを取得する
 * @param path 作業ディレクトリからの相対パス
 * @returns パス
 */
export function getWorkdirPath(path: string): string {
    return join(workdir, path);
}
