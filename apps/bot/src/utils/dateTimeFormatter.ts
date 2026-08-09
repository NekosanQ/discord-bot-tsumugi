/**
 * Dateオブジェクトを「YYYY/MM/DD HH:mm:ss (X年前)」の形式にフォーマットする。
 * @param date フォーマット対象のDateオブジェクト
 * @returns フォーマット済みの文字列
 */
export function dateTimeFormatter(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const absoluteDate = `${String(year)}/${month}/${day} ${hours}:${minutes}:${seconds}`;

    const today = new Date();
    let yearsAgo = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        yearsAgo--;
    }
    const relativeDate = `(${String(yearsAgo)}年前)`;

    return `${absoluteDate} ${relativeDate}`;
}
