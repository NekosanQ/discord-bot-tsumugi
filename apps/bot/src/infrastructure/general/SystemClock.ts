import type { Clock } from '../../application/general/Clock.js';

export class SystemClock implements Clock {
    public now(): Date {
        return new Date();
    }
}
