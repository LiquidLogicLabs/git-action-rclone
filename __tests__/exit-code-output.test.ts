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

/**
 * `exit-code` is declared in action.yml and documented in the README, but was
 * never carried out of the runner, so consumers reading it always got an empty
 * string. The exit code was captured inside runRclone and then discarded --
 * TransferResult had nowhere to put it.
 */
function inputs(over: Partial<ActionInputs> = {}): ActionInputs {
  return {
    sources: ['test-file.txt'], recursive: true, mode: 'sync', remoteType: 'local',
    remoteHost: '', remotePort: '', remoteUser: '', remotePass: '',
    remotePath: '/tmp/rclone-exitcode-test', rcloneConfig: '', rcloneFlags: '',
    skipCertificateCheck: false, include: [], exclude: [], deleteExcluded: false,
    installRclone: true, rcloneVersion: 'latest', dryRun: false, verbose: false,
    debugMode: false, ...over,
  };
}

describe('exit code is carried out of the runner', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rclone-ec-'));
    fs.writeFileSync(path.join(tmp, 'test-file.txt'), 'x');
    jest.clearAllMocks();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('reports 0 for a successful transfer', async () => {
    mockedExec.exec.mockResolvedValue(0);
    const results = await runTransfers(inputs({ sources: [path.join(tmp, 'test-file.txt')] }), new Logger(false));
    expect(results[0].exitCode).toBe(0);
  });

  it('reports the real non-zero code for a failed transfer', async () => {
    mockedExec.exec.mockResolvedValue(7);
    const results = await runTransfers(inputs({ sources: [path.join(tmp, 'test-file.txt')] }), new Logger(false));
    expect(results[0].success).toBe(false);
    expect(results[0].exitCode).toBe(7);
  });

  it('reports a non-zero code when the process throws rather than exiting', async () => {
    mockedExec.exec.mockRejectedValue(new Error('spawn ENOENT'));
    const results = await runTransfers(inputs({ sources: [path.join(tmp, 'test-file.txt')] }), new Logger(false));
    expect(results[0].success).toBe(false);
    expect(results[0].exitCode).not.toBe(0);
  });
});
