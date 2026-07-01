# Postman Export Organizer

A desktop app for analyzing and organizing Postman data exports. Import your Postman backup, connect your API key, and get a clear view of your collections and environments organized by workspace — with duplicate detection, member info, and structured export.

https://github.com/user-attachments/assets/165b7cda-ac30-46a7-bdef-587246952c3d

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

- **Two Data Sources** — Import a Postman data export (.zip) _or_ fetch directly from the Postman API using your API key
- **Workspace Organization** — Collections and environments grouped by workspace, with owner and member info from the Postman API
- **Duplicate Detection** — Finds duplicate requests (exact and possible matches) and duplicate collection names across workspaces
- **Export** — Export organized collections/environments as a structured zip (all workspaces or individual)
- **Reports** — Export analysis reports as JSON or CSV
- **Search & Filter** — Filter workspaces by name, type, or duplicates
- **Member Info** — Shows workspace owner and members with roles, resolved via the Postman API
- **Progress Tracking** — Real-time progress bar for both ZIP and API modes during analysis

## Privacy & Security

🔒 **100% local & private.** Your API key, files, and data are **never saved, stored, or sent to any third-party service**. All processing happens entirely on your device.

- Your Postman API key is held in memory only and is discarded when you close the app
- No analytics, telemetry, or tracking of any kind
- The only network calls are to the **official Postman API** (`api.getpostman.com`) — and only when you explicitly trigger an analysis
- Export files are written only to locations you choose via the save dialog

The app is fully [open source](https://github.com/james-ha-bruno/postman-export-organizer-app) — you can audit every line of code.

## Getting Started

### Install the App

Download the latest release from the [Releases page](https://github.com/james-ha-bruno/postman-export-organizer-app/releases). No development tools required — just install and run.

> **macOS users:** See the [macOS Installation](#macos-installation) section above if you get a Gatekeeper warning.

### Build from Source

If you want to modify the code or run a development build:

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/james-ha-bruno/postman-export-organizer-app.git
cd postman-export-organizer-app
npm install
npm run tauri dev     # Run in development mode
npm run tauri build   # Build a release binary
```

---

## Usage

The app offers two ways to get your Postman data. Choose the one that fits your situation:

### Option 1: ZIP Export Mode

Best for **one-time migrations** or when you want a complete offline snapshot of your data.

1. In Postman, go to **Settings** → **Data** → **Export Data**
2. Select the data you want and click **Request Data Export**
3. Postman will email you a download link when the export is ready (can take several minutes for large accounts)
4. In the app, select **ZIP Export**, pick the downloaded `.zip` file, enter your API key, and click **Analyze Export**

The ZIP contains all your collections and environments. The API key is used to fetch workspace metadata (names, members, ownership) that isn't included in the export.

📖 [Postman docs: Exporting data](https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/)

### Option 2: Postman API Mode

Best for **quick lookups** or when you don't want to wait for a data export. No ZIP file needed.

1. In the app, select **Postman API**
2. Enter your API key and click **Fetch & Analyze**
3. The app fetches all your workspaces, collections, and environments directly from the Postman API

This mode makes one API call per collection and environment, so it may take longer for large accounts. A real-time progress bar shows what's being fetched.

### Getting Your Postman API Key (required for both options)

1. Go to [Postman API Keys](https://go.postman.co/settings/me/api-keys)
2. Click **Generate API Key**, give it a name, and copy the key
3. The key starts with `PMAK-...`

📖 [Postman docs: Postman API authentication](https://learning.postman.com/docs/developer/postman-api/authentication/)

---

## Postman API Rate Limits & Plan Limits

The app uses the Postman API to fetch workspace details, collections, and environments. Postman enforces a **rate limit of 300 requests per minute** across all plans.

Additionally, each Postman plan has a **monthly API call limit**:

| Plan | Monthly API Calls | Best For |
| ---- | ----------------: | -------- |
| **Free** | 10,000 | Small personal accounts |
| **Solo** ($9/mo) | 100,000 | Individual power users |
| **Team** ($19/user/mo) | 1,000,000 | Teams with many workspaces |
| **Enterprise** ($49/user/mo) | 10,000,000 | Large organizations |

### How many API calls does the app use?

**ZIP Export mode** makes approximately:
- 1 call to list workspaces
- 1 call per workspace (to fetch details/members)
- 1 call to list team users
- **Total ≈ number of workspaces + 2**

**Postman API mode** makes all the above, plus:
- 1 call per collection (to fetch full collection JSON)
- 1 call per environment (to fetch full environment JSON)
- **Total ≈ workspaces + collections + environments + 2**

> **Example:** An account with 20 workspaces, 150 collections, and 30 environments would use ~22 API calls in ZIP mode or ~202 calls in API mode.

> ⚠️ **Free plan users** should prefer ZIP Export mode to conserve their 10,000 monthly call limit. API mode can use hundreds of calls for large accounts.

📖 [Postman docs: API usage & rate limits](https://learning.postman.com/docs/developer/postman-api/postman-api-rate-limits/)

---

## How It Works

1. **Choose a source** — Select ZIP Export or Postman API mode
2. **Connect** — Enter your Postman API key
3. **Analyze** — The app parses your data, fetches workspace metadata, and detects duplicates
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

