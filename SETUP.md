# Setup

This project runs two entry points by default:

- Editor: `http://localhost:3000`
- Viewer: `http://localhost:3001`

The editor is where coaches build and publish plays.  
The viewer is the read-only version for players or assistants.

## Requirements

- Node.js 20+
- npm

For Docker setup instead:

- Docker
- Docker Compose

## Local Setup

1. Copy `.env.example` to `.env`
2. Set your passwords in `.env`
3. Install dependencies
4. Start the server

```bash
npm install
npm start
```

Open:

- Editor: `http://localhost:3000`
- Viewer: `http://localhost:3001`

## Docker Setup

1. Copy `.env.example` to `.env`
2. Set your passwords in `.env`
3. Start the container

```bash
docker compose up -d --build
```

Open:

- Editor: `http://localhost:3000`
- Viewer: `http://localhost:3001`

## Configuration

These values live in `.env`:

```env
EDITOR_PORT=3000
VIEWER_PORT=3001
EDITOR_PASSWORD=change-me-editor
VIEWER_PASSWORD=change-me-viewer
```

Notes:

- `EDITOR_PORT` is the coach-facing editor
- `VIEWER_PORT` is the read-only published viewer
- You should change both passwords before sharing the app

## Data Storage

The playbook data is stored in:

```text
playbook.db
```

If you are using Docker, the same file is mounted into the container, so your data stays in the repo directory.

## First Use

1. Open the editor
2. Log in with `EDITOR_PASSWORD`
3. Create or edit plays
4. Click `Publish`
5. Open the viewer
6. Log in with `VIEWER_PASSWORD`

## Resetting Data

If you want a clean local state, stop the app and replace or remove `playbook.db`.

## Troubleshooting

### Port already in use

Change `EDITOR_PORT` or `VIEWER_PORT` in `.env`, then restart.

### Viewer does not show new changes

The viewer only shows the latest published version.  
After editing plays in the editor, click `Publish`.

### Login works but wrong screen opens

Use the correct port:

- editor login on the editor port
- viewer login on the viewer port
