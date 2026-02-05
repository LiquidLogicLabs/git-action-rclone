# rclone Publish Action

A GitHub Action that installs [rclone](https://rclone.org/) and publishes files or folders to any rclone-supported remote storage backend.

Supports **GitHub Actions**, **Gitea Actions**, and **nektos/act** local runner.

## Features

- Optionally installs rclone (skips if already available)
- Publishes files, lists of files, folders, or lists of folders
- Supports recursive and non-recursive folder transfers
- **Sync mode** (default): one-way mirror that deletes remote files not in source
- **Copy mode**: additive only, never deletes remote files
- Works with any rclone backend (SFTP, S3, WebDAV, FTP, local, and [many more](https://rclone.org/overview/))
- Auto-obscures passwords for secure configuration
- Include/exclude file filters with rclone pattern syntax
- Delete-excluded option to remove excluded files from remote
- Skip TLS certificate checks for self-signed certificates
- Dry-run support for safe testing

## Quick Start

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: dist/
    remoteType: sftp
    remoteHost: files.example.com
    remoteUser: deploy
    remotePass: ${{ secrets.DEPLOY_PASSWORD }}
    remotePath: /var/www/mysite
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sources` | **yes** | — | Comma or newline-separated list of files/folders to publish |
| `recursive` | no | `true` | Recursively copy folder contents |
| `mode` | no | `sync` | Transfer mode: `sync` (mirror, deletes extra remote files) or `copy` (additive only) |
| `remoteType` | no* | — | rclone backend type (`sftp`, `s3`, `webdav`, `ftp`, `local`, etc.) |
| `remoteHost` | no* | — | Remote server address (http/https URLs auto-extract path to remotePath) |
| `remotePort` | no | — | Remote server port |
| `remoteUser` | no | — | Auth username |
| `remotePass` | no | — | Auth password (plain-text; auto-obscured by the action) |
| `remotePath` | no | `/` | Base path on the remote |
| `rcloneConfig` | no | — | Raw rclone.conf content (overrides individual remote inputs) |
| `rcloneFlags` | no | — | Extra flags passed to every rclone command |
| `skipCertCheck` | no | `false` | Skip TLS certificate verification (for self-signed certs) |
| `include` | no | — | Comma/newline-separated include filter patterns (only matching files transferred) |
| `exclude` | no | — | Comma/newline-separated exclude filter patterns (matching files skipped) |
| `deleteExcluded` | no | `false` | Delete files on remote that match exclude patterns |
| `installRclone` | no | `true` | Install rclone if not found on PATH |
| `rcloneVersion` | no | `latest` | rclone version to install |
| `dryRun` | no | `false` | Run with `--dry-run` (no files transferred) |
| `verbose` | no | `false` | Enable verbose logging |

\* Either `remoteType` + `remoteHost` **or** `rcloneConfig` is required.

## Outputs

| Output | Description |
|--------|-------------|
| `success` | `true` if all transfers succeeded |
| `transferredFiles` | Total number of files transferred |
| `rcloneVersion` | Installed rclone version |

## Permissions

```yaml
permissions:
  contents: read
```

No elevated permissions required.

## Examples

### Sync a folder via SFTP

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: build/
    mode: sync
    remoteType: sftp
    remoteHost: files.example.com
    remoteUser: deploy
    remotePass: ${{ secrets.SFTP_PASSWORD }}
    remotePath: /var/www/html
```

### Copy multiple files to S3

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: |
      dist/app.js
      dist/app.css
      dist/index.html
    mode: copy
    remoteType: s3
    remoteHost: s3.amazonaws.com
    remotePath: my-bucket/deploy
    rcloneFlags: '--s3-region us-east-1'
  env:
    RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY }}
    RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
```

### Upload to WebDAV (Nextcloud)

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: reports/
    mode: copy
    remoteType: webdav
    remoteHost: https://cloud.example.com/remote.php/dav/files/user/
    remoteUser: user
    remotePass: ${{ secrets.NEXTCLOUD_PASSWORD }}
    remotePath: /uploads
    rcloneFlags: '--webdav-vendor nextcloud'
```

### Custom rclone config

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: data/
    rcloneConfig: |
      [myremote]
      type = sftp
      host = example.com
      user = deploy
      pass = ${{ secrets.RCLONE_OBSCURED_PASS }}
      shell_type = unix
```

### Sync with exclude filter

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: build/
    mode: sync
    remoteType: sftp
    remoteHost: files.example.com
    remoteUser: deploy
    remotePass: ${{ secrets.SFTP_PASSWORD }}
    remotePath: /var/www/html
    exclude: '*.tmp, .git/**, node_modules/**'
    deleteExcluded: 'true'
```

### Self-signed certificate

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: dist/
    remoteType: webdav
    remoteHost: https://internal-server.local/dav/
    remoteUser: admin
    remotePass: ${{ secrets.WEBDAV_PASSWORD }}
    remotePath: /uploads
    skipCertCheck: 'true'
```

### Dry run for testing

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: dist/
    remoteType: sftp
    remoteHost: files.example.com
    remoteUser: deploy
    remotePass: ${{ secrets.DEPLOY_PASSWORD }}
    remotePath: /var/www/mysite
    dryRun: 'true'
    verbose: 'true'
```

## Security

- `remotePass` is masked via `core.setSecret()` — it will never appear in logs
- When using individual inputs (not `rcloneConfig`), passwords are auto-obscured via `rclone obscure` before being set as environment variables
- Temp config files (when using `rcloneConfig`) are written with mode `0600` and deleted after use
- Never commit real secrets; use GitHub Secrets or equivalent

## Local Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

### Testing with act

```bash
npm run test:act:e2e
```

## License

MIT
