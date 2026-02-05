export declare class Logger {
    private verbose;
    constructor(verbose: boolean);
    info(message: string): void;
    debug(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    group<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
