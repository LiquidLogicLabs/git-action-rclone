import { Logger } from './logger';
export declare function getRcloneVersion(logger: Logger): Promise<string | null>;
export declare function isRcloneInstalled(): Promise<boolean>;
export declare function ensureRclone(install: boolean, version: string, logger: Logger): Promise<string>;
