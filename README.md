# 7on7 Playbook

A web app for building and sharing 7-on-7 football playbooks.

This public repo is a sanitized copy of the original coaching tool. It keeps the playbook editor, defense designer, print flow, and password-protected viewer, while removing roster files, contact data, private deployment scripts, and auth secrets.

## What It Does

- Draw offensive plays with routes, motion, and custom formations
- Design defensive calls with coverage zones and defender assignments
- Organize plays by formation in a sidebar
- Publish the current playbook to a read-only viewer
- Print grouped play sheets from the browser
- Persist data in a local SQLite database

## Screenshots

| Editor: offense play design | Editor: defense coverage design |
| --- | --- |
| ![Offense editor](docs/screenshots/editor-offense.png) | ![Defense editor](docs/screenshots/editor-defense.png) |

![Published viewer](docs/screenshots/viewer.png)

## Main Features

### Offense editor

- Drag players onto the field and draw routes directly on canvas
- Mix route and motion segments in the same play
- Save custom formations and reuse them across plays
- Split formations into groups for alternate personnel packages

### Defense editor

- Switch to a dedicated defense view
- Start from preset fronts such as `4-2-1`
- Assign coverage zones to defenders and visualize spacing on the field

### Publish and share

- Save a snapshot of the current playbook into the viewer database
- Let players or coaches open a separate read-only viewer page
- Keep editor and viewer behind separate passwords

### Print workflow

- Print offense or defense installs from the browser
- Group plays by formation for easier handouts

## Quick Start

```bash
npm install
npm start
```

Copy `.env.example` to `.env`, then set `VIEWER_PASSWORD` and `EDITOR_PASSWORD`.

Then open:

- Editor: `http://localhost:20011/editor`
- Viewer: `http://localhost:20011/viewer`

Full setup details are in [SETUP.md](./SETUP.md).

## Repository Scope

Included:

- The web app runtime
- A starter `playbook.db` with playbook data only
- Docker support

Removed from the public copy:

- Real roster or contact data
- Google Sheets sync tooling
- Private TLS keys
- Personal deployment and remote access scripts

## Stack

- Node.js
- Express
- SQLite via `better-sqlite3`
- Vanilla JavaScript
- HTML5 Canvas
