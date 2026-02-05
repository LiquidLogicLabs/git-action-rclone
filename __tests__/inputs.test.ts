import * as core from '@actions/core';
import { getInputs } from '../src/inputs';

jest.mock('@actions/core');

const mockedCore = core as jest.Mocked<typeof core>;

function mockInput(inputs: Record<string, string>) {
  mockedCore.getInput.mockImplementation((name: string) => inputs[name] || '');
  mockedCore.getBooleanInput.mockImplementation((name: string) => {
    const val = inputs[name];
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === undefined) return false;
    throw new Error(`Input does not meet YAML 1.2 "Core Schema" specification: ${name}`);
  });
}

describe('getInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses valid comma-separated sources', () => {
    mockInput({
      sources: 'dist/,README.md, src/file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'sftp',
      remoteHost: 'example.com',
      remotePath: '/uploads',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.sources).toEqual(['dist/', 'README.md', 'src/file.txt']);
    expect(inputs.mode).toBe('sync');
    expect(inputs.remoteType).toBe('sftp');
    expect(inputs.remotePath).toBe('/uploads');
  });

  it('parses newline-separated sources', () => {
    mockInput({
      sources: 'dist/\nREADME.md\nsrc/',
      recursive: 'true',
      mode: 'copy',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.sources).toEqual(['dist/', 'README.md', 'src/']);
    expect(inputs.mode).toBe('copy');
  });

  it('trims whitespace and filters empty entries', () => {
    mockInput({
      sources: '  dist/ , , README.md ,  ',
      recursive: 'false',
      mode: 'sync',
      remoteType: 'sftp',
      remoteHost: 'host.com',
      remotePath: '/',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.sources).toEqual(['dist/', 'README.md']);
  });

  it('throws on empty sources', () => {
    mockInput({
      sources: '  ,  , ',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'sftp',
      remoteHost: 'host.com',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'sources' must contain at least one");
  });

  it('throws on invalid mode', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'mirror',
      remoteType: 'sftp',
      remoteHost: 'host.com',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'mode' must be one of: sync, copy");
  });

  it('throws when neither rcloneConfig nor remoteType is provided', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("Either 'rcloneConfig' or 'remoteType'");
  });

  it('throws when non-local remoteType is used without remoteHost', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'sftp',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'remoteHost' is required");
  });

  it('allows local remoteType without remoteHost', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteType).toBe('local');
    expect(inputs.remoteHost).toBe('');
  });

  it('masks remotePass as a secret', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'sftp',
      remoteHost: 'host.com',
      remotePass: 'my-secret-pass',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    getInputs();
    expect(mockedCore.setSecret).toHaveBeenCalledWith('my-secret-pass');
  });

  it('accepts rcloneConfig without remoteType', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'copy',
      rcloneConfig: '[myremote]\ntype = sftp\nhost = example.com',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.rcloneConfig).toContain('[myremote]');
    expect(inputs.remoteType).toBe('');
  });

  it('parses comma-separated include patterns', () => {
    mockInput({
      sources: 'dist/',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      include: '*.txt, *.log',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
      skipCertCheck: 'false',
      deleteExcluded: 'false',
    });

    const inputs = getInputs();
    expect(inputs.include).toEqual(['*.txt', '*.log']);
  });

  it('parses newline-separated exclude patterns', () => {
    mockInput({
      sources: 'dist/',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      exclude: '*.tmp\n.git/**',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
      skipCertCheck: 'false',
      deleteExcluded: 'false',
    });

    const inputs = getInputs();
    expect(inputs.exclude).toEqual(['*.tmp', '.git/**']);
  });

  it('returns empty arrays for unset include/exclude', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
      skipCertCheck: 'false',
      deleteExcluded: 'false',
    });

    const inputs = getInputs();
    expect(inputs.include).toEqual([]);
    expect(inputs.exclude).toEqual([]);
  });

  it('defaults skipCertCheck and deleteExcluded to false', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
      skipCertCheck: 'false',
      deleteExcluded: 'false',
    });

    const inputs = getInputs();
    expect(inputs.skipCertCheck).toBe(false);
    expect(inputs.deleteExcluded).toBe(false);
  });

  it('warns when deleteExcluded is true but no exclude patterns set', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '/tmp/dest',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
      skipCertCheck: 'false',
      deleteExcluded: 'true',
    });

    getInputs();
    expect(mockedCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('deleteExcluded')
    );
  });

  it('defaults remotePath to / when empty', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      remoteType: 'local',
      remotePath: '',
      installRclone: 'true',
      rcloneVersion: 'latest',
      dryRun: 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.remotePath).toBe('/');
  });
});
