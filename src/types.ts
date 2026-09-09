export type TransferMode = 'sync' | 'copy';

export interface ActionInputs {
  sources: string[];
  recursive: boolean;
  mode: TransferMode;
  remoteType: string;
  remoteHost: string;
  remotePort: string;
  remoteUser: string;
  remotePass: string;
  remotePath: string;
  rcloneConfig: string;
  rcloneFlags: string;
  skipCertificateCheck: boolean;
  include: string[];
  exclude: string[];
  deleteExcluded: boolean;
  installRclone: boolean;
  rcloneVersion: string;
  dryRun: boolean;
  verbose: boolean;
  debugMode: boolean;
}

export interface TransferResult {
  source: string;
  success: boolean;
  filesTransferred: number;
  error?: string;
  /**
   * Exit status of the rclone invocation for this source. 0 on success. When
   * the process could not be run at all (it threw rather than exiting), this
   * is 1, since there is no real code to report.
   */
  exitCode: number;
}

export interface RcloneStats {
  filesTransferred: number;
}
