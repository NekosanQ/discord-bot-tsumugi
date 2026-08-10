import { drawOmikuji, type OmikujiResult } from '../../../domain/fun/omikuji/Omikuji.js';
import type { RandomSource } from '../RandomSource.js';

export class DrawOmikuji {
    public constructor(private readonly randomSource: RandomSource) {}

    public execute(): OmikujiResult {
        return drawOmikuji({
            fortune: this.randomSource.next(),
            hope: this.randomSource.next(),
            lostItem: this.randomSource.next(),
            learning: this.randomSource.next(),
            conflict: this.randomSource.next(),
            love: this.randomSource.next(),
            disease: this.randomSource.next()
        });
    }
}
