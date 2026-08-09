export interface OmikujiResult {
    fortune: string;
    hope: string;
    lostItem: string;
    learning: string;
    conflict: string;
    love: string;
    disease: string;
}

/**
 * おみくじの抽選を行うサービスクラス
 */
class OmikujiService {
    /**
     * おみくじを引いて、結果のデータオブジェクトを返します。
     * @returns おみくじの結果が格納されたオブジェクト
     */
    public draw(): OmikujiResult {
        return {
            fortune: this.selectFortune(),
            hope: this.selectHope(),
            lostItem: this.selectLostItem(),
            learning: this.selectLearning(),
            conflict: this.selectConflict(),
            love: this.selectLove(),
            disease: this.selectDisease()
        };
    }

    private selectFortune(): string {
        const fortuneList = [
            { fortune: '大吉', probability: 20 },
            { fortune: '中吉', probability: 15 },
            { fortune: '小吉', probability: 15 },
            { fortune: '吉', probability: 20 },
            { fortune: '末吉', probability: 20 },
            { fortune: '凶', probability: 8 },
            { fortune: '大凶', probability: 2 }
        ];

        const totalProbability = fortuneList.reduce((acc, item) => acc + item.probability, 0);
        let random = Math.floor(Math.random() * totalProbability);

        const selectedFortune = fortuneList.find((item) => {
            if (random < item.probability) {
                return true;
            }
            random -= item.probability;
            return false;
        });
        return selectedFortune ? selectedFortune.fortune : '大吉';
    }

    private selectRandomItem(list: string[]): string {
        return list[Math.floor(Math.random() * list.length)];
    }

    private selectHope(): string {
        return this.selectRandomItem([
            '叶う',
            '全力で願え',
            '日頃の行いによりけり',
            '良い事を沢山せよ 叶う',
            '叶うであろう だが油断禁物。',
            '叶わない事ありけり'
        ]);
    }

    private selectLostItem(): string {
        return this.selectRandomItem([
            '出る',
            '出るであろう 下',
            '出るであろう 上',
            '出るであろう 周りを見よ',
            '出るであろう 横',
            '出るであろう 隙間',
            '日頃の行いによりけり',
            '出にくい'
        ]);
    }

    private selectLearning(): string {
        return this.selectRandomItem([
            '安心して勉学せよ',
            '勉学すればよろし',
            '勉学を推奨する',
            '困難。勉学せよ',
            '全力を尽くせ',
            '自己の甘えを捨てよ'
        ]);
    }

    private selectConflict(): string {
        return this.selectRandomItem([
            '勝てる 油断禁物',
            '勝てるであろう',
            '勝ちがたし',
            '勝ちがたし 控えよ',
            '勝ちがたし 時を待て',
            '困難 諦めよ',
            '全力を尽くせ',
            '自己の甘えを捨てよ'
        ]);
    }

    private selectLove(): string {
        return this.selectRandomItem([
            'この人を逃すな',
            '自分磨きをせよ',
            '感情を抑えよ',
            '見た目で選ぶな',
            '中身で選べ',
            '積極的になれ',
            '日頃の行いによりけり'
        ]);
    }

    private selectDisease(): string {
        return this.selectRandomItem([
            '信じろ なおる',
            '医者への信心第一',
            '医師に頼め',
            '無駄な事をするな',
            '信神第一',
            '異変あれば急げ',
            '日頃の行いによりけり'
        ]);
    }
}

export default new OmikujiService();
