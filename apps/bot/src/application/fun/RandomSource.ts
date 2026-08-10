export interface RandomSource {
    /** 0以上1未満の疑似乱数を返す。 */
    next: () => number;
}
