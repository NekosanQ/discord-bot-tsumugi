/** Dateを既存表示形式へ変換する。相対年数の基準時刻は呼び出し側から受け取る。 */
export function formatDateTime(date: Date, now: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const absoluteDate = `${String(year)}/${month}/${day} ${hours}:${minutes}:${seconds}`;

    let yearsAgo = now.getFullYear() - date.getFullYear();
    const monthDifference = now.getMonth() - date.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < date.getDate())) yearsAgo--;

    return `${absoluteDate} (${String(yearsAgo)}年前)`;
}
