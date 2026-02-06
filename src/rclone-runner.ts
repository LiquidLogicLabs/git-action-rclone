import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ActionInputs, TransferResult, RcloneStats } from './types';
import { Logger } from './logger';

async function obscurePassword(password: string): Promise<string> {
  let output = '';
  await exec.exec('rclone', ['obscure', password], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });
  return output.trim();
}

// Backends that use 'url' instead of 'host' for server address
const URL_BASED_BACKENDS = ['webdav', 'http', 'swift'];

function buildEnvConfig(inputs: ActionInputs, obscuredPass: string): Record<string, string> {
  const env: Record<string, string> = {};

  env['RCLONE_CONFIG_REMOTE_TYPE'] = inputs.remoteType;

  if (inputs.remoteHost) {
    // Different backends use different config parameter names for the server address
    if (URL_BASED_BACKENDS.includes(inputs.remoteType)) {
      env['RCLONE_CONFIG_REMOTE_URL'] = inputs.remoteHost;
    } else {
      env['RCLONE_CONFIG_REMOTE_HOST'] = inputs.remoteHost;
    }
  }
  if (inputs.remotePort) {
    env['RCLONE_CONFIG_REMOTE_PORT'] = inputs.remotePort;
  }
  if (inputs.remoteUser) {
    env['RCLONE_CONFIG_REMOTE_USER'] = inputs.remoteUser;
  }
  if (obscuredPass) {
    env['RCLONE_CONFIG_REMOTE_PASS'] = obscuredPass;
  }

  return env;
}

function parseRemoteName(configContent: string): string {
  const match = configContent.match(/^\[([^\]]+)\]/m);
  return match ? match[1] : 'remote';
}

async function writeTempConfig(content: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const configPath = path.join(tmpDir, `rclone-${Date.now()}.conf`);
  fs.writeFileSync(configPath, content, { mode: 0o600 });
  return configPath;
}

function parseTransferStats(output: string): RcloneStats {
  let filesTransferred = 0;

  // Try JSON log format first
  const lines = output.split('\n');
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.stats && typeof parsed.stats.transfers === 'number') {
        filesTransferred = parsed.stats.transfers;
      }
    } catch {
      // Not JSON, try text format
      const match = line.match(/Transferred:\s+(\d+)\s+\/\s+(\d+)/);
      if (match) {
        filesTransferred = parseInt(match[1], 10);
      }
    }
  }

  return { filesTransferred };
}

export async function runTransfers(
  inputs: ActionInputs,
  logger: Logger
): Promise<TransferResult[]> {
  const results: TransferResult[] = [];
  let configPath: string | null = null;
  let remoteName = 'remote';

  // Build remote configuration
  let extraEnv: Record<string, string> = {};

  if (inputs.rcloneConfig) {
    // Mode B: raw config file
    configPath = await writeTempConfig(inputs.rcloneConfig);
    remoteName = parseRemoteName(inputs.rcloneConfig);
    logger.debug(`Using custom rclone config, remote name: ${remoteName}`);
  } else {
    // Mode A: env-based config
    let obscuredPass = '';
    if (inputs.remotePass) {
      logger.debug('Obscuring remote password...');
      obscuredPass = await obscurePassword(inputs.remotePass);
    }
    extraEnv = buildEnvConfig(inputs, obscuredPass);
    logger.debug(`Configured remote type: ${inputs.remoteType}`);
  }

  try {
    for (const source of inputs.sources) {
      const result = await transferSource(
        source,
        remoteName,
        inputs,
        extraEnv,
        configPath,
        logger
      );
      results.push(result);
    }
  } finally {
    // Clean up temp config file
    if (configPath) {
      try {
        fs.unlinkSync(configPath);
        logger.debug('Cleaned up temp rclone config.');
      } catch {
        logger.warn('Failed to clean up temp rclone config file.');
      }
    }
  }

  return results;
}

async function transferSource(
  source: string,
  remoteName: string,
  inputs: ActionInputs,
  extraEnv: Record<string, string>,
  configPath: string | null,
  logger: Logger
): Promise<TransferResult> {
  // Check for trailing slash BEFORE resolving (indicates "sync contents only")
  const syncContentsOnly = source.endsWith('/') || source.endsWith(path.sep);
  const resolvedSource = path.resolve(source);

  if (!fs.existsSync(resolvedSource)) {
    return {
      source,
      success: false,
      filesTransferred: 0,
      error: `Source path does not exist: ${resolvedSource}`,
    };
  }

  const stat = fs.statSync(resolvedSource);
  const isDirectory = stat.isDirectory();

  // Build the destination path
  let destPath = inputs.remotePath;
  if (isDirectory && !syncContentsOnly) {
    // For directories without trailing slash, use the directory name as subfolder on remote
    destPath = path.posix.join(inputs.remotePath, path.basename(resolvedSource));
  }

  const dest = `${remoteName}:${destPath}`;

  // Build rclone args
  const args: string[] = [inputs.mode];

  if (isDirectory) {
    args.push(resolvedSource);
  } else {
    // For single files, copy the parent dir with --include filter
    args.push(path.dirname(resolvedSource));
    args.push('--include', path.basename(resolvedSource));
  }

  args.push(dest);

  if (isDirectory && !inputs.recursive) {
    args.push('--max-depth', '1');
  }

  // Include/exclude filters only apply to directory sources
  if (isDirectory) {
    for (const pattern of inputs.include) {
      args.push('--include', pattern);
    }
    for (const pattern of inputs.exclude) {
      args.push('--exclude', pattern);
    }
    if (inputs.deleteExcluded) {
      args.push('--delete-excluded');
    }
  }

  if (inputs.skipCertCheck) {
    args.push('--no-check-certificate');
  }

  if (inputs.dryRun) {
    args.push('--dry-run');
  }

  if (inputs.verbose) {
    args.push('-v');
  }

  args.push('--stats-one-line-date');
  args.push('--stats-log-level', 'NOTICE');

  if (configPath) {
    args.push('--config', configPath);
  }

  // Append user-provided extra flags
  if (inputs.rcloneFlags) {
    const extraFlags = inputs.rcloneFlags.split(/\s+/).filter((f) => f.length > 0);
    args.push(...extraFlags);
  }

  logger.info(`Transferring: ${source} → ${dest} (mode: ${inputs.mode})`);
  logger.debug(`rclone ${args.join(' ')}`);

  let stdout = '';
  let stderr = '';

  try {
    const exitCode = await exec.exec('rclone', args, {
      env: { ...process.env, ...extraEnv } as { [key: string]: string },
      silent: !inputs.verbose,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        },
      },
      ignoreReturnCode: true,
    });

    const stats = parseTransferStats(stdout + stderr);

    if (exitCode !== 0) {
      const errorMsg = stderr.trim() || `rclone exited with code ${exitCode}`;
      logger.error(`Transfer failed for ${source}: ${errorMsg}`);
      return {
        source,
        success: false,
        filesTransferred: stats.filesTransferred,
        error: errorMsg,
      };
    }

    logger.info(`Transfer complete: ${source} (${stats.filesTransferred} files)`);
    return {
      source,
      success: true,
      filesTransferred: stats.filesTransferred,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error during transfer';
    logger.error(`Transfer error for ${source}: ${msg}`);
    return {
      source,
      success: false,
      filesTransferred: 0,
      error: msg,
    };
  }
}
