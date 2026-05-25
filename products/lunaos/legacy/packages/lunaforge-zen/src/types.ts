import { ModeContext, Mode } from "lunaforge-core";

export interface ZenState {
    isFocusing: boolean;
    startTime?: number;
    lastSummary?: string;
    nextStep?: string;
}

export interface ZenAPI {
    startFocus(): Promise<void>;
    stopFocus(): Promise<void>;
    getSummary(): Promise<string>;
}
