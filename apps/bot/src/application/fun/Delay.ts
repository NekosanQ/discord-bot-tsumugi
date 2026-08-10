export interface Delay {
    wait: (milliseconds: number) => Promise<void>;
}
