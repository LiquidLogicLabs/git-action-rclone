import { ActionInputs, TransferResult } from './types';
import { Logger } from './logger';
export declare function runTransfers(inputs: ActionInputs, logger: Logger): Promise<TransferResult[]>;
