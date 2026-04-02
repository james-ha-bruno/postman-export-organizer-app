# Postman Export Organizer

A desktop app for analyzing and organizing Postman data exports. Import your Postman backup, connect your API key, and get a clear view of your collections and environments organized by workspace — with duplicate detection, member info, and structured export.

<!-- screenshot -->

## Disclaimer

This is an independent, community-built tool. It is **not affiliated with, endorsed by, or associated with Postman, Inc. or Bruno** in any way. Postman® is a trademark of Postman, Inc.

This software is provided "as-is" without warranty of any kind. Use it at your own risk. The authors are not responsible for any data loss, corruption, or other issues that may arise from its use. **Always back up your data before using this tool.**

## macOS Installation

Since the app is not code-signed with an Apple Developer certificate, macOS Gatekeeper will show a **"damaged and can't be opened"** error when you first try to open it. This is normal for unsigned apps downloaded from the internet — the app is not actually damaged.

To fix it, run this in Terminal:

```bash
xattr -cr /Applications/Postman\ Export\ Organizer.app
```

Then open the app again normally.

## Features

- **Import & Analyze** — Load a Postman data export (.zip) and connect your Postman API key
- **Workspace Organization** — Collections and environments grouped by workspace, with owner and member info from the Postman API
- **Duplicate Detection** — Finds duplicate requests (exact and possible matches) and duplicate collection names across workspaces
- **Export** — Export organized collections/environments as a structured zip (all workspaces or individual)
- **Reports** — Export analysis reports as JSON or CSV
- **Search & Filter** — Filter workspaces by name, type, or duplicates
- **Member Info** — Shows workspace owner and members with roles, resolved via the Postman API

## Getting Started

### Option 1: Download the App

If you just want to **use** the app, download the latest release from the [Releases page](https://github.com/james-ha-bruno/postman-export-organizer-app/releases). No development tools required — just install and run.

> **macOS users:** See the [macOS Installation](#macos-installation) section above if you get a Gatekeeper warning.

### Option 2: Build from Source

If you want to **modify the code** or run a development build, you'll need:

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/)

Then:

```bash
git clone https://github.com/james-ha-bruno/postman-export-organizer-app.git
cd postman-export-organizer-app
npm install
npm run tauri dev     # Run in development mode
npm run tauri build   # Build a release binary
```

---

### Postman Setup (required for both options)

Before using the app, you'll need two things from Postman:

#### 1. Export Your Postman Data

The app works with Postman's **Data Export** format — a zip file containing all your collections, environments, and metadata.

To export your data:
1. Go to **Settings** → **Data** → **Export Data** in Postman
2. Select the data you want to export and click **Request Data Export**
3. Postman will email you a download link when the export is ready

📖 [Postman docs: Exporting data](https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/)

#### 2. Get Your Postman API Key

The app uses the Postman API to fetch workspace details, member info, and other metadata that isn't included in the data export.

To generate an API key:
1. Go to [Postman API Keys](https://go.postman.co/settings/me/api-keys)
2. Click **Generate API Key**, give it a name, and copy the key
3. The key starts with `PMAK-...`

> ⚠️ Your API key is only used locally and is never stored to disk. All API calls are made from the app's backend process.

📖 [Postman docs: Postman API authentication](https://learning.postman.com/docs/developer/postman-api/authentication/)

## How It Works

1. **Import** — Select your Postman data export (.zip)
2. **Connect** — Enter your Postman API key
3. **Analyze** — The app parses the export, fetches workspace and member data from the Postman API, and detects duplicates
4. **Explore** — Browse collections and environments organized by workspace, review duplicates, and inspect member roles
5. **Export** — Download organized collections as a structured zip, or export analysis reports as JSON/CSV

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend  | Rust (Tauri v2)                   |
| Build    | Vite                              |
| APIs     | Postman API (workspaces, users)   |

## Project Structure

```
src/               React frontend
  components/      UI components (SetupScreen, Explorer, WorkspaceCard,
                   ExportPanel, SummaryBar, SearchFilter, DuplicateDetails)
  types.ts         TypeScript type definitions
src-tauri/         Rust backend
  src/
    api.rs         Postman API calls
    analysis.rs    Duplicate detection and analysis
    commands.rs    Tauri command handlers
    export.rs      Zip export logic
    models.rs      Data models
    parser.rs      Postman export parser
```

## License

MIT

