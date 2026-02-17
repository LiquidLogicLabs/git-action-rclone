import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as os from 'os';
import * as path from 'path';
import { Logger } from './logger';

/** Resolve "latest" to the current stable release tag (e.g. "v1.68.2") from GitHub. */
async function resolveLatestVersion(logger: Logger): Promise<string> {
  logger.info('Resolving latest rclone version from GitHub...');
  const res = await fetch('https://api.github.com/repos/rclone/rclone/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve latest rclone version: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tag_name?: string };
  const tag = data.tag_name;
  if (!tag || typeof tag !== 'string') {
    throw new Error('Invalid response from GitHub releases API: missing tag_name');
  }
  logger.debug(`Latest rclone version: ${tag}`);
  return tag;
}

export async function getRcloneVersion(logger: Logger): Promise<string | null> {
  try {
    let output = '';
    await exec.exec('rclone', ['version'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    });
    const match = output.match(/rclone\s+(v[\d.]+)/);
    if (match) {
      logger.debug(`Found rclone ${match[1]}`);
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function isRcloneInstalled(): Promise<boolean> {
  try {
    await io.which('rclone', true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install rclone on Linux/macOS without sudo. Uses a user-writable directory
 * (RUNNER_TEMP or tool-cache) and adds it to PATH so it works in CI, act, and
 * restricted environments.
 */
async function installLinuxMac(version: string, logger: Logger): Promise<string> {
  const resolvedVersion = version === 'latest' ? await resolveLatestVersion(logger) : version;
  const cleanVersion = resolvedVersion.startsWith('v') ? resolvedVersion : `v${resolvedVersion}`;
  const platform = os.platform() === 'darwin' ? 'osx' : 'linux';
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  const filename = `rclone-${cleanVersion}-${platform}-${arch}`;
  const url = `https://downloads.rclone.org/${cleanVersion}/${filename}.zip`;

  logger.info(`Downloading rclone ${cleanVersion} from ${url}...`);

  const downloadPath = await tc.downloadTool(url);
  const extractedPath = await tc.extractZip(downloadPath);

  const cachedPath = await tc.cacheDir(extractedPath, 'rclone', cleanVersion);
  const cachedBinDir = path.join(cachedPath, filename);

  core.addPath(cachedBinDir);
  return path.join(cachedBinDir, 'rclone');
}

async function installWindows(version: string, logger: Logger): Promise<string> {
  const cleanVersion = version === 'latest' ? 'current' : version.startsWith('v') ? version : `v${version}`;
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  const filename = cleanVersion === 'current'
    ? `rclone-current-windows-${arch}`
    : `rclone-${cleanVersion}-windows-${arch}`;
  const url = cleanVersion === 'current'
    ? `https://downloads.rclone.org/${filename}.zip`
    : `https://downloads.rclone.org/${cleanVersion}/${filename}.zip`;

  logger.info(`Downloading rclone for Windows from ${url}...`);

  const downloadPath = await tc.downloadTool(url);
  const extractedPath = await tc.extractZip(downloadPath);

  const binDir = path.join(extractedPath, filename);
  core.addPath(binDir);

  return path.join(binDir, 'rclone.exe');
}

export async function ensureRclone(
  install: boolean,
  version: string,
  logger: Logger
): Promise<string> {
  const existing = await getRcloneVersion(logger);
  if (existing) {
    logger.info(`rclone already installed: ${existing}`);
    return existing;
  }

  if (!install) {
    throw new Error(
      'rclone is not installed and installRclone is disabled. ' +
        'Install rclone manually or set installRclone to true.'
    );
  }

  const platform = os.platform();

  if (platform === 'linux' || platform === 'darwin') {
    await installLinuxMac(version, logger);
  } else if (platform === 'win32') {
    await installWindows(version, logger);
  } else {
    throw new Error(`Unsupported platform: ${platform}. rclone install supports linux, darwin, and win32.`);
  }

  const installedVersion = await getRcloneVersion(logger);
  if (!installedVersion) {
    throw new Error('rclone installation completed but version check failed. Installation may be broken.');
  }

  logger.info(`rclone ${installedVersion} installed successfully.`);
  return installedVersion;
}
