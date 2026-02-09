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
    remote-type: sftp
    remote-host: files.example.com
    remote-user: deploy
    remote-pass: ${{ secrets.DEPLOY_PASSWORD }}
    remote-path: /var/www/mysite
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sources` | **yes** | — | Comma or newline-separated list of files/folders to publish. For folders, a trailing slash (`dir/`) syncs contents directly; without it (`dir`), the folder name is appended to remote-path |
| `recursive` | no | `true` | Recursively copy folder contents |
| `mode` | no | `sync` | Transfer mode: `sync` (mirror, deletes extra remote files) or `copy` (additive only) |
| `remote-type` | no* | — | rclone backend type (`sftp`, `s3`, `webdav`, `ftp`, `local`, etc.) |
| `remote-host` | no* | — | Remote server address (http/https URLs auto-extract path to remote-path) |
| `remote-port` | no | — | Remote server port |
| `remote-user` | no | — | Auth username |
| `remote-pass` | no | — | Auth password (plain-text; auto-obscured by the action) |
| `remote-path` | no | `/` | Base path on the remote |
| `rclone-config` | no | — | Raw rclone.conf content (overrides individual remote inputs) |
| `rclone-flags` | no | — | Extra flags passed to every rclone command |
| `skip-certificate-check` | no | `false` | Skip TLS certificate verification (for self-signed certs) |
| `include` | no | — | Comma/newline-separated include filter patterns (only matching files transferred) |
| `exclude` | no | — | Comma/newline-separated exclude filter patterns (matching files skipped) |
| `delete-excluded` | no | `false` | Delete files on remote that match exclude patterns |
| `install-rclone` | no | `true` | Install rclone if not found on PATH |
| `rclone-version` | no | `latest` | rclone version to install |
| `dry-run` | no | `false` | Run with `--dry-run` (no files transferred) |
| `verbose` | no | `false` | Enable verbose logging (also dumps filter rules) |

\* Either `remote-type` + `remote-host` **or** `rclone-config` is required.

## Outputs

| Output | Description |
|--------|-------------|
| `success` | `true` if all transfers succeeded |
| `transferred-files` | Total number of files transferred |
| `rclone-version` | Installed rclone version |
| `exit-code` | Exit code of the last rclone command |

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
    remote-type: sftp
    remote-host: files.example.com
    remote-user: deploy
    remote-pass: ${{ secrets.SFTP_PASSWORD }}
    remote-path: /var/www/html
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
    remote-type: s3
    remote-host: s3.amazonaws.com
    remote-path: my-bucket/deploy
    rclone-flags: '--s3-region us-east-1'
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
    remote-type: webdav
    remote-host: https://cloud.example.com/remote.php/dav/files/user/
    remote-user: user
    remote-pass: ${{ secrets.NEXTCLOUD_PASSWORD }}
    remote-path: /uploads
    rclone-flags: '--webdav-vendor nextcloud'
```

### Custom rclone config

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: data/
    rclone-config: |
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
    remote-type: sftp
    remote-host: files.example.com
    remote-user: deploy
    remote-pass: ${{ secrets.SFTP_PASSWORD }}
    remote-path: /var/www/html
    exclude: '*.tmp, .git/**, node_modules/**'
    delete-excluded: 'true'
```

### Self-signed certificate

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: dist/
    remote-type: webdav
    remote-host: https://internal-server.local/dav/
    remote-user: admin
    remote-pass: ${{ secrets.WEBDAV_PASSWORD }}
    remote-path: /uploads
    skip-certificate-check: 'true'
```

### Dry run for testing

```yaml
- uses: LiquidLogicLabs/git-action-rclone@v1
  with:
    sources: dist/
    remote-type: sftp
    remote-host: files.example.com
    remote-user: deploy
    remote-pass: ${{ secrets.DEPLOY_PASSWORD }}
    remote-path: /var/www/mysite
    dry-run: 'true'
    verbose: 'true'
```

## Filter Patterns

The `include` and `exclude` inputs use [rclone's filter pattern syntax](https://rclone.org/filtering/). Key patterns:

| Pattern | Matches |
|---------|---------|
| `*.json` | `.json` files in the root directory only |
| `**.json` | `.json` files at any level (root and subdirectories) |
| `**/*.json` | `.json` files in subdirectories only (NOT root level) |
| `dir/**` | Everything inside `dir/` |
| `*` | All files in root directory |
| `**` | All files at any level |

**Common gotcha:** Use `**.json` (not `**/*.json`) to match files at all levels including root.

Example — sync only JSON files:
```yaml
include: '**.json'
exclude: '*'
```

## Security

- `remote-pass` is masked via `core.setSecret()` — it will never appear in logs
- When using individual inputs (not `rclone-config`), passwords are auto-obscured via `rclone obscure` before being set as environment variables
- Temp config files (when using `rclone-config`) are written with mode `0600` and deleted after use
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
