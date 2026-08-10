export interface OmikujiResult {
    fortune: string;
    hope: string;
    lostItem: string;
    learning: string;
    conflict: string;
    love: string;
    disease: string;
}

export interface OmikujiRandomValues {
    fortune: number;
    hope: number;
    lostItem: number;
    learning: number;
    conflict: number;
    love: number;
    disease: number;
}

const FORTUNES = [
    { value: '大吉', weight: 20 },
    { value: '中吉', weight: 15 },
    { value: '小吉', weight: 15 },
    { value: '吉', weight: 20 },
    { value: '末吉', weight: 20 },
    { value: '凶', weight: 8 },
    { value: '大凶', weight: 2 }
] as const;

const HOPES = ['叶う', '全力で願え', '日頃の行いによりけり', '良い事を沢山せよ 叶う', '叶うであろう だが油断禁物。', '叶わない事ありけり'] as const;
const LOST_ITEMS = [
    '出る',
    '出るであろう 下',
    '出るであろう 上',
    '出るであろう 周りを見よ',
    '出るであろう 横',
    '出るであろう 隙間',
    '日頃の行いによりけり',
    '出にくい'
] as const;
const LEARNING = ['安心して勉学せよ', '勉学すればよろし', '勉学を推奨する', '困難。勉学せよ', '全力を尽くせ', '自己の甘えを捨てよ'] as const;
const CONFLICTS = [
    '勝てる 油断禁物',
    '勝てるであろう',
    '勝ちがたし',
    '勝ちがたし 控えよ',
    '勝ちがたし 時を待て',
    '困難 諦めよ',
    '全力を尽くせ',
    '自己の甘えを捨てよ'
] as const;
const LOVE = ['この人を逃すな', '自分磨きをせよ', '感情を抑えよ', '見た目で選ぶな', '中身で選べ', '積極的になれ', '日頃の行いによりけり'] as const;
const DISEASES = [
    '信じろ なおる',
    '医者への信心第一',
    '医師に頼め',
    '無駄な事をするな',
    '信神第一',
    '異変あれば急げ',
    '日頃の行いによりけり'
] as const;

function selectRandomItem<T>(items: readonly [T, ...T[]], randomValue: number): T {
    return items[Math.floor(randomValue * items.length)] ?? items[0];
}

function selectFortune(randomValue: number): string {
    const totalWeight = FORTUNES.reduce((total, item) => total + item.weight, 0);
    let weightedIndex = Math.floor(randomValue * totalWeight);

    for (const fortune of FORTUNES) {
        if (weightedIndex < fortune.weight) return fortune.value;
        weightedIndex -= fortune.weight;
    }

    return FORTUNES[0].value;
}

/** 乱数値だけを入力として、おみくじ結果を決定する。 */
export function drawOmikuji(randomValues: OmikujiRandomValues): OmikujiResult {
    return {
        fortune: selectFortune(randomValues.fortune),
        hope: selectRandomItem(HOPES, randomValues.hope),
        lostItem: selectRandomItem(LOST_ITEMS, randomValues.lostItem),
        learning: selectRandomItem(LEARNING, randomValues.learning),
        conflict: selectRandomItem(CONFLICTS, randomValues.conflict),
        love: selectRandomItem(LOVE, randomValues.love),
        disease: selectRandomItem(DISEASES, randomValues.disease)
    };
}
