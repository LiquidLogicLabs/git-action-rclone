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
  installRclone: boolean;
  rcloneVersion: string;
  dryRun: boolean;
  verbose: boolean;
}

export interface TransferResult {
  source: string;
  success: boolean;
  filesTransferred: number;
  error?: string;
}

export interface RcloneStats {
  filesTransferred: number;
}
