# Setup

## What is included

- `playbook.db`: starter playbook database with app content only

## What was removed

- `.env` with real passwords
- `tools/token_sheets.json` and any OAuth client secrets
- `certs/cert.pem` and `certs/key.pem`
- `2026Spr_Panthers/` and other real roster/personnel files
- `update_lineups_sheet.py`, `tools/reauth_sheets.py`, `requirements-sheets.txt`
- `examples/`
- `deploy.sh`, `backup.sh`, `login.sh`, `REMOTE_SETUP.md`
- Local-only folders such as `node_modules/`, `.claude/`, `.agents/`, `.specify/`

## Local run

1. Copy `.env.example` to `.env`
2. Change `VIEWER_PASSWORD` and `EDITOR_PASSWORD`
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm start
```

5. Open:

- Editor: `http://localhost:3000/editor`
- Viewer: `http://localhost:3000/viewer`

If `certs/cert.pem` and `certs/key.pem` exist, the app also starts HTTPS on `https://localhost:3443`.

## Docker run

1. Copy `.env.example` to `.env`
2. Change the passwords
3. Start:

```bash
docker compose up -d --build
```

4. Open:

- Editor: `http://localhost:3000/editor`
- Viewer: `http://localhost:3000/viewer`

The compose file mounts:
- `./playbook.db` into the container database path
- `./certs` for optional HTTPS certs

## Optional HTTPS

Place these files before starting the app:

- `certs/cert.pem`
- `certs/key.pem`

Optional env:

- `PUBLIC_HTTPS_URL=https://your-hostname:3443`

If the cert files are missing, the app still runs on HTTP.
