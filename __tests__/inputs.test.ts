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
      'remote-type': 'sftp',
      'remote-host': 'example.com',
      'remote-path': '/uploads',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
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
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
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
      'remote-type': 'sftp',
      'remote-host': 'host.com',
      'remote-path': '/',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
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
      'remote-type': 'sftp',
      'remote-host': 'host.com',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'sources' must contain at least one");
  });

  it('throws on invalid mode', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'mirror',
      'remote-type': 'sftp',
      'remote-host': 'host.com',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'mode' must be one of: sync, copy");
  });

  it('throws when neither rclone-config nor remote-type is provided', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("Either 'rclone-config' or 'remote-type'");
  });

  it('throws when non-local remote-type is used without remote-host', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'sftp',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    expect(() => getInputs()).toThrow("'remote-host' is required");
  });

  it('allows local remote-type without remote-host', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteType).toBe('local');
    expect(inputs.remoteHost).toBe('');
  });

  it('masks remote-pass as a secret', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'sftp',
      'remote-host': 'host.com',
      'remote-pass': 'my-secret-pass',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    getInputs();
    expect(mockedCore.setSecret).toHaveBeenCalledWith('my-secret-pass');
  });

  it('accepts rclone-config without remote-type', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'copy',
      'rclone-config': '[myremote]\ntype = sftp\nhost = example.com',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
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
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      include: '*.txt, *.log',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.include).toEqual(['*.txt', '*.log']);
  });

  it('parses newline-separated exclude patterns', () => {
    mockInput({
      sources: 'dist/',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      exclude: '*.tmp\n.git/**',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.exclude).toEqual(['*.tmp', '.git/**']);
  });

  it('returns empty arrays for unset include/exclude', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.include).toEqual([]);
    expect(inputs.exclude).toEqual([]);
  });

  it('defaults skip-certificate-check and delete-excluded to false', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.skipCertificateCheck).toBe(false);
    expect(inputs.deleteExcluded).toBe(false);
  });

  it('warns when delete-excluded is true but no exclude patterns set', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '/tmp/dest',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'true',
    });

    getInputs();
    expect(mockedCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('delete-excluded')
    );
  });

  it('defaults remote-path to / when empty', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'local',
      'remote-path': '',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
    });

    const inputs = getInputs();
    expect(inputs.remotePath).toBe('/');
  });

  it('extracts path from URL in remote-host', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'webdav',
      'remote-host': 'https://cloud.example.com/remote.php/dav/files/user',
      'remote-path': '',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteHost).toBe('https://cloud.example.com');
    expect(inputs.remotePath).toBe('/remote.php/dav/files/user');
  });

  it('leaves remote-path unchanged when URL has no path', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'webdav',
      'remote-host': 'https://cloud.example.com',
      'remote-path': '/uploads',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteHost).toBe('https://cloud.example.com');
    expect(inputs.remotePath).toBe('/uploads');
  });

  it('throws when URL has path and remote-path is also set', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'webdav',
      'remote-host': 'https://cloud.example.com/dav',
      'remote-path': '/uploads',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    expect(() => getInputs()).toThrow("Cannot set both a URL path in 'remote-host' and 'remote-path'");
  });

  it('does not parse non-URL remote-host', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'sftp',
      'remote-host': 'files.example.com',
      'remote-path': '/var/www',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteHost).toBe('files.example.com');
    expect(inputs.remotePath).toBe('/var/www');
  });

  it('preserves port in URL origin', () => {
    mockInput({
      sources: 'file.txt',
      recursive: 'true',
      mode: 'sync',
      'remote-type': 'webdav',
      'remote-host': 'https://cloud.example.com:8443/dav',
      'remote-path': '',
      'install-rclone': 'true',
      'rclone-version': 'latest',
      'dry-run': 'false',
      verbose: 'false',
      'skip-certificate-check': 'false',
      'delete-excluded': 'false',
    });

    const inputs = getInputs();
    expect(inputs.remoteHost).toBe('https://cloud.example.com:8443');
    expect(inputs.remotePath).toBe('/dav');
  });
});
