import * as core from '@actions/core';
import { ActionInputs, TransferMode } from './types';

const VALID_MODES: TransferMode[] = ['sync', 'copy'];

function parseSources(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function getInputs(): ActionInputs {
  const sourcesRaw = core.getInput('sources', { required: true });
  const sources = parseSources(sourcesRaw);

  if (sources.length === 0) {
    throw new Error("Input 'sources' must contain at least one file or folder path.");
  }

  const mode = core.getInput('mode') as TransferMode;
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Input 'mode' must be one of: ${VALID_MODES.join(', ')}. Got: '${mode}'`);
  }

  const remotePass = core.getInput('remotePass');
  if (remotePass) {
    core.setSecret(remotePass);
  }

  const rcloneConfig = core.getInput('rcloneConfig');
  const remoteType = core.getInput('remoteType');
  const remoteHost = core.getInput('remoteHost');

  if (!rcloneConfig && !remoteType) {
    throw new Error(
      "Either 'rcloneConfig' or 'remoteType' (with 'remoteHost') must be provided."
    );
  }

  if (remoteType && remoteType !== 'local' && !remoteHost && !rcloneConfig) {
    throw new Error(
      `Input 'remoteHost' is required when 'remoteType' is '${remoteType}' (non-local backend).`
    );
  }

  return {
    sources,
    recursive: core.getBooleanInput('recursive'),
    mode,
    remoteType,
    remoteHost,
    remotePort: core.getInput('remotePort'),
    remoteUser: core.getInput('remoteUser'),
    remotePass,
    remotePath: core.getInput('remotePath') || '/',
    rcloneConfig,
    rcloneFlags: core.getInput('rcloneFlags'),
    installRclone: core.getBooleanInput('installRclone'),
    rcloneVersion: core.getInput('rcloneVersion') || 'latest',
    dryRun: core.getBooleanInput('dryRun'),
    verbose: core.getBooleanInput('verbose'),
  };
}
