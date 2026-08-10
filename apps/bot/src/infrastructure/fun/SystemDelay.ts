import type { Delay } from '../../application/fun/Delay.js';

export class SystemDelay implements Delay {
    public wait(milliseconds: number): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
