import * as core from '@actions/core';

export class Logger {
  private verbose: boolean;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  info(message: string): void {
    core.info(message);
  }

  debug(message: string): void {
    if (this.verbose) {
      core.info(`[DEBUG] ${message}`);
    } else {
      core.debug(message);
    }
  }

  warn(message: string): void {
    core.warning(message);
  }

  error(message: string): void {
    core.error(message);
  }

  group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return core.group(name, fn);
  }
}
