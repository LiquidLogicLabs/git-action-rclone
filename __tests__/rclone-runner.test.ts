import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTransfers } from '../src/rclone-runner';
import { ActionInputs } from '../src/types';
import { Logger } from '../src/logger';

jest.mock('@actions/exec');
jest.mock('@actions/core');

const mockedExec = exec as jest.Mocked<typeof exec>;

function createLogger(): Logger {
  return new Logger(false);
}

function createBaseInputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return {
    sources: ['test-file.txt'],
    recursive: true,
    mode: 'sync',
    remoteType: 'local',
    remoteHost: '',
    remotePort: '',
    remoteUser: '',
    remotePass: '',
    remotePath: '/tmp/rclone-test-dest',
    rcloneConfig: '',
    rcloneFlags: '',
    skipCertCheck: false,
    include: [],
    exclude: [],
    deleteExcluded: false,
    installRclone: true,
    rcloneVersion: 'latest',
    dryRun: false,
    verbose: false,
    ...overrides,
  };
}

describe('runTransfers', () => {
  let tmpDir: string;
  let testFile: string;
  let testDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rclone-test-'));
    testFile = path.join(tmpDir, 'test-file.txt');
    fs.writeFileSync(testFile, 'hello world');
    testDir = path.join(tmpDir, 'test-dir');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'inner.txt'), 'inner content');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds correct rclone sync command for a file', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testFile] });
    const results = await runTransfers(inputs, createLogger());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    const execCall = mockedExec.exec.mock.calls[0];
    expect(execCall[0]).toBe('rclone');
    const args = execCall[1] as string[];
    expect(args[0]).toBe('sync');
    expect(args).toContain('--include');
    expect(args).toContain('test-file.txt');
    expect(args).toContain('remote:/tmp/rclone-test-dest');
  });

  it('builds correct rclone copy command for a directory', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testDir], mode: 'copy' });
    const results = await runTransfers(inputs, createLogger());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    const execCall = mockedExec.exec.mock.calls[0];
    const args = execCall[1] as string[];
    expect(args[0]).toBe('copy');
    expect(args).toContain(testDir);
    expect(args[1]).toBe(testDir);
  });

  it('adds --max-depth 1 when recursive is false for a directory', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testDir], recursive: false });
    const results = await runTransfers(inputs, createLogger());

    expect(results[0].success).toBe(true);
    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--max-depth');
    expect(args).toContain('1');
  });

  it('adds --dry-run flag when dryRun is true', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testFile], dryRun: true });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--dry-run');
  });

  it('adds -v flag when verbose is true', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testFile], verbose: true });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('-v');
  });

  it('appends rcloneFlags', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testFile],
      rcloneFlags: '--transfers 8 --checkers 16',
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--transfers');
    expect(args).toContain('8');
    expect(args).toContain('--checkers');
    expect(args).toContain('16');
  });

  it('reports failure for non-existent source', async () => {
    const inputs = createBaseInputs({ sources: ['/nonexistent/path.txt'] });
    const results = await runTransfers(inputs, createLogger());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('does not exist');
  });

  it('reports failure when rclone returns non-zero exit code', async () => {
    mockedExec.exec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('permission denied'));
      }
      return 1;
    });

    const inputs = createBaseInputs({ sources: [testFile] });
    const results = await runTransfers(inputs, createLogger());

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('permission denied');
  });

  it('handles multiple sources, continues on failure', async () => {
    let callCount = 0;
    mockedExec.exec.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? 1 : 0;
    });

    const inputs = createBaseInputs({ sources: [testFile, testDir] });
    const results = await runTransfers(inputs, createLogger());

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it('uses rcloneConfig file when provided', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testFile],
      rcloneConfig: '[myremote]\ntype = local\n',
      remoteType: '',
    });
    const results = await runTransfers(inputs, createLogger());

    expect(results[0].success).toBe(true);
    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--config');
    // Verify the remote name was parsed
    expect(args.some((a: string) => a.startsWith('myremote:'))).toBe(true);
  });

  it('adds --no-check-certificate when skipCertCheck is true', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({ sources: [testFile], skipCertCheck: true });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--no-check-certificate');
  });

  it('adds --include flags for directory sources', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testDir],
      include: ['*.txt', '*.log'],
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    const includeIndices = args.reduce<number[]>((acc, val, idx) => {
      if (val === '--include') acc.push(idx);
      return acc;
    }, []);
    expect(includeIndices).toHaveLength(2);
    expect(args[includeIndices[0] + 1]).toBe('*.txt');
    expect(args[includeIndices[1] + 1]).toBe('*.log');
  });

  it('adds --exclude flags for directory sources', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testDir],
      exclude: ['*.tmp', '.git/**'],
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    const excludeIndices = args.reduce<number[]>((acc, val, idx) => {
      if (val === '--exclude') acc.push(idx);
      return acc;
    }, []);
    expect(excludeIndices).toHaveLength(2);
    expect(args[excludeIndices[0] + 1]).toBe('*.tmp');
    expect(args[excludeIndices[1] + 1]).toBe('.git/**');
  });

  it('adds --delete-excluded when deleteExcluded is true', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testDir],
      exclude: ['*.tmp'],
      deleteExcluded: true,
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    expect(args).toContain('--delete-excluded');
  });

  it('does not apply include/exclude filters to single-file sources', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testFile],
      include: ['*.log'],
      exclude: ['*.tmp'],
      deleteExcluded: true,
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    // Should have the file-level --include for the filename, but not the filter patterns
    expect(args).toContain('--include');
    expect(args).toContain('test-file.txt');
    expect(args).not.toContain('*.log');
    expect(args).not.toContain('*.tmp');
    expect(args).not.toContain('--exclude');
    expect(args).not.toContain('--delete-excluded');
  });

  it('applies include before exclude in args order', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testDir],
      include: ['*.txt'],
      exclude: ['*.tmp'],
    });
    await runTransfers(inputs, createLogger());

    const args = mockedExec.exec.mock.calls[0][1] as string[];
    const includeIdx = args.indexOf('--include');
    const excludeIdx = args.indexOf('--exclude');
    expect(includeIdx).toBeLessThan(excludeIdx);
  });

  it('sets RCLONE_CONFIG_REMOTE_* env vars for env-based config', async () => {
    mockedExec.exec.mockResolvedValue(0);

    const inputs = createBaseInputs({
      sources: [testFile],
      remoteType: 'sftp',
      remoteHost: 'example.com',
      remotePort: '2222',
      remoteUser: 'admin',
    });
    await runTransfers(inputs, createLogger());

    const execOptions = mockedExec.exec.mock.calls[0][2];
    expect(execOptions?.env).toMatchObject({
      RCLONE_CONFIG_REMOTE_TYPE: 'sftp',
      RCLONE_CONFIG_REMOTE_HOST: 'example.com',
      RCLONE_CONFIG_REMOTE_PORT: '2222',
      RCLONE_CONFIG_REMOTE_USER: 'admin',
    });
  });
});
