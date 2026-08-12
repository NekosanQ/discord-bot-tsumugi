import { expect, test } from '@playwright/test';

test('Discord loginからkeywordの追加と削除を完了できる', async ({ page }): Promise<void> => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Discordでログイン' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const overwrittenHeadersAccepted = await page.evaluate(async (): Promise<boolean> => {
        const headers = new Headers();
        headers.set('x-tsumugi-web-proxy', 'browser-value');
        headers.set('x-tsumugi-client-id', 'browser-value');
        const response = await fetch('/api/dashboard/session', {
            headers
        });
        return response.ok;
    });
    expect(overwrittenHeadersAccepted).toBe(true);
    await page.getByRole('link', { name: /Fake Guild/ }).click();
    await page.getByRole('link', { name: /general/ }).click();

    await page.getByRole('textbox', { name: 'キーワード', exact: true }).fill('hello');
    await page.getByRole('textbox', { name: '応答', exact: true }).fill('world');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('キーワードを保存しました。')).toBeVisible();
    await expect(page.getByText('hello')).toBeVisible();
    await expect(page.getByText('world')).toBeVisible();

    await page.getByRole('button', { name: 'helloを削除' }).click();
    await expect(page.getByText('キーワードを削除しました。')).toBeVisible();
    await expect(page.getByText('キーワードはまだありません')).toBeVisible();

    const logoutResponsePromise = page.waitForResponse(
        (response): boolean => response.url().endsWith('/api/dashboard/logout') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'ログアウト' }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(204);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: 'Discordでログイン' })).toBeVisible();
});
