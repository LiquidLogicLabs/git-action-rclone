import * as core from '@actions/core';
import { getInputs } from './config';
import { ensureRclone } from './rclone-installer';
import { runTransfers } from './rclone-runner';
import { Logger } from './logger';

async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const logger = new Logger(inputs.verbose, inputs.debugMode);

    logger.debug('Parsed inputs successfully.');

    // Step 1: Ensure rclone is available
    const rcloneVersion = await logger.group('Ensure rclone', async () => {
      return ensureRclone(inputs.installRclone, inputs.rcloneVersion, logger);
    });
    core.setOutput('rclone-version', rcloneVersion);

    // Step 2: Run transfers
    const results = await logger.group('Transfer files', async () => {
      return runTransfers(inputs, logger);
    });

    // Step 3: Summarize results
    const totalFiles = results.reduce((sum, r) => sum + r.filesTransferred, 0);
    const allSucceeded = results.every((r) => r.success);
    const failedSources = results.filter((r) => !r.success);

    core.setOutput('transferred-files', totalFiles.toString());
    core.setOutput('success', allSucceeded ? 'true' : 'false');

    // action.yml documents this as the exit code of the last rclone command,
    // so report the last transfer's status. It was declared and documented but
    // never set, so consumers always read an empty string.
    const lastExitCode = results.length > 0 ? results[results.length - 1].exitCode : 0;
    core.setOutput('exit-code', String(lastExitCode));

    if (failedSources.length > 0) {
      const summary = failedSources
        .map((r) => `  - ${r.source}: ${r.error}`)
        .join('\n');
      core.setFailed(
        `${failedSources.length} of ${results.length} transfer(s) failed:\n${summary}`
      );
    } else {
      logger.info(
        `All ${results.length} transfer(s) completed successfully. ${totalFiles} file(s) transferred.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(message);
  }
}

run();
