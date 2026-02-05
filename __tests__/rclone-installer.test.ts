import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { getRcloneVersion, isRcloneInstalled, ensureRclone } from '../src/rclone-installer';
import { Logger } from '../src/logger';

jest.mock('@actions/exec');
jest.mock('@actions/io');
jest.mock('@actions/core');
jest.mock('@actions/tool-cache');

const mockedExec = exec as jest.Mocked<typeof exec>;
const mockedIo = io as jest.Mocked<typeof io>;

function createLogger(): Logger {
  return new Logger(false);
}

describe('getRcloneVersion', () => {
  it('returns version when rclone is installed', async () => {
    mockedExec.exec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('rclone v1.68.2\n- os/version: ...'));
      }
      return 0;
    });

    const version = await getRcloneVersion(createLogger());
    expect(version).toBe('v1.68.2');
  });

  it('returns null when rclone is not installed', async () => {
    mockedExec.exec.mockRejectedValue(new Error('command not found'));

    const version = await getRcloneVersion(createLogger());
    expect(version).toBeNull();
  });

  it('returns null when output does not match version pattern', async () => {
    mockedExec.exec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('unexpected output'));
      }
      return 0;
    });

    const version = await getRcloneVersion(createLogger());
    expect(version).toBeNull();
  });
});

describe('isRcloneInstalled', () => {
  it('returns true when rclone is on PATH', async () => {
    mockedIo.which.mockResolvedValue('/usr/local/bin/rclone');
    expect(await isRcloneInstalled()).toBe(true);
  });

  it('returns false when rclone is not on PATH', async () => {
    mockedIo.which.mockRejectedValue(new Error('not found'));
    expect(await isRcloneInstalled()).toBe(false);
  });
});

describe('ensureRclone', () => {
  it('returns existing version when rclone is already installed', async () => {
    mockedExec.exec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('rclone v1.68.2\n'));
      }
      return 0;
    });

    const version = await ensureRclone(true, 'latest', createLogger());
    expect(version).toBe('v1.68.2');
  });

  it('throws when rclone is not installed and installRclone is false', async () => {
    mockedExec.exec.mockRejectedValue(new Error('not found'));

    await expect(ensureRclone(false, 'latest', createLogger())).rejects.toThrow(
      'rclone is not installed and installRclone is disabled'
    );
  });
});
