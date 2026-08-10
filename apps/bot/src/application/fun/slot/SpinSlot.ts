import { type SlotResult, spinSlot } from '../../../domain/fun/slot/Slot.js';
import type { Delay } from '../Delay.js';
import type { RandomSource } from '../RandomSource.js';

export interface SpinSlotOptions {
    rotationMilliseconds?: number;
}

export class SpinSlot {
    private readonly rotationMilliseconds: number;

    public constructor(
        private readonly randomSource: RandomSource,
        private readonly delay: Delay,
        options: SpinSlotOptions = {}
    ) {
        this.rotationMilliseconds = options.rotationMilliseconds ?? 1_500;
    }

    public async execute(): Promise<SlotResult> {
        await this.delay.wait(this.rotationMilliseconds);
        return spinSlot([this.randomSource.next(), this.randomSource.next(), this.randomSource.next()]);
    }
}
