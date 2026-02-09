import * as core from '@actions/core';
import { ActionInputs, TransferMode } from './types';

const VALID_MODES: TransferMode[] = ['sync', 'copy'];

function parseList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBoolean(val?: string): boolean {
  return val?.toLowerCase() === 'true' || val === '1';
}

export function getInputs(): ActionInputs {
  const sourcesRaw = core.getInput('sources', { required: true });
  const sources = parseList(sourcesRaw);

  if (sources.length === 0) {
    throw new Error("Input 'sources' must contain at least one file or folder path.");
  }

  const mode = core.getInput('mode') as TransferMode;
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Input 'mode' must be one of: ${VALID_MODES.join(', ')}. Got: '${mode}'`);
  }

  const remotePass = core.getInput('remote-pass');
  if (remotePass) {
    core.setSecret(remotePass);
  }

  const rcloneConfig = core.getInput('rclone-config');
  const remoteType = core.getInput('remote-type');
  let remoteHost = core.getInput('remote-host');

  if (!rcloneConfig && !remoteType) {
    throw new Error(
      "Either 'rclone-config' or 'remote-type' (with 'remote-host') must be provided."
    );
  }

  if (remoteType && remoteType !== 'local' && !remoteHost && !rcloneConfig) {
    throw new Error(
      `Input 'remote-host' is required when 'remote-type' is '${remoteType}' (non-local backend).`
    );
  }

  // Parse URL path from remoteHost (http/https URLs only)
  const rawRemotePath = core.getInput('remote-path');
  let remotePath = rawRemotePath || '/';

  if (remoteHost && (remoteHost.startsWith('http://') || remoteHost.startsWith('https://'))) {
    try {
      const url = new URL(remoteHost);
      if (url.pathname && url.pathname !== '/') {
        if (rawRemotePath && rawRemotePath !== '/') {
          throw new Error(
            "Cannot set both a URL path in 'remote-host' and 'remote-path'. Use one or the other."
          );
        }
        remotePath = url.pathname;
      }
      remoteHost = url.origin;
    } catch (e) {
      if (e instanceof Error && e.message.includes('Cannot set both')) throw e;
      // Not a valid URL, treat as plain hostname
    }
  }

  const exclude = parseList(core.getInput('exclude'));
  const deleteExcluded = core.getBooleanInput('delete-excluded');

  if (deleteExcluded && exclude.length === 0) {
    core.warning("'delete-excluded' is enabled but no 'exclude' patterns are set. It will have no effect.");
  }

  const verboseInput = core.getBooleanInput('verbose');
  const debugMode =
    (typeof core.isDebug === 'function' && core.isDebug()) ||
    parseBoolean(process.env.ACTIONS_STEP_DEBUG) ||
    parseBoolean(process.env.ACTIONS_RUNNER_DEBUG) ||
    parseBoolean(process.env.RUNNER_DEBUG);
  const verbose = verboseInput || debugMode;

  return {
    sources,
    recursive: core.getBooleanInput('recursive'),
    mode,
    remoteType,
    remoteHost,
    remotePort: core.getInput('remote-port'),
    remoteUser: core.getInput('remote-user'),
    remotePass,
    remotePath,
    rcloneConfig,
    rcloneFlags: core.getInput('rclone-flags'),
    skipCertificateCheck: core.getBooleanInput('skip-certificate-check'),
    include: parseList(core.getInput('include')),
    exclude,
    deleteExcluded,
    installRclone: core.getBooleanInput('install-rclone'),
    rcloneVersion: core.getInput('rclone-version') || 'latest',
    dryRun: core.getBooleanInput('dry-run'),
    verbose,
    debugMode,
  };
}
