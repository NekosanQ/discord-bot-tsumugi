export interface PingMeasurementInput {
    websocketPingMilliseconds: number;
    interactionCreatedTimestamp: number;
    replyCreatedTimestamp: number;
}

export interface PingMeasurement {
    websocketPing: string;
    apiLatency: string;
}

export class MeasurePing {
    public execute(input: PingMeasurementInput): PingMeasurement {
        return {
            websocketPing: `${String(input.websocketPingMilliseconds)}ms`,
            apiLatency: `${String(input.replyCreatedTimestamp - input.interactionCreatedTimestamp)}ms`
        };
    }
}
