# ProcureMap

ProcureMap turns a location, material, and search radius into a procurement supplier map. It uses the internal Xila/Corevo data interfaces, enriches the nearest suppliers, and renders an interactive supplier intelligence dashboard.

## Desktop App (Tauri v2)

Built with Rust backend + React frontend.

### Dev

```bash
cd src-tauri && cargo run
```

The Tauri app opens a native desktop window with the full UI: workspace, analysis form, live processing pipeline, and interactive results with map, filters, and supplier detail drawer.

### Build

```bash
cd src-tauri && cargo build --release
```

The release binary lands at `src-tauri/target/release/ProcureMap`.

### Frontend

```bash
npm install
npm run dev     # Vite dev server (browser-only, no Tauri)
npm run build   # Production build
```

## Architecture

- **Backend**: Rust (Tauri v2) — SQLite, JWT auth, Xila API client, 15-component supplier scoring, CSV export
- **Frontend**: React + TypeScript + Vite — Zustand stores, Leaflet map, Soft Bento design system
- **Pipeline**: search → detail → enrich → scoring → report (progress events streamed via Tauri event system)
