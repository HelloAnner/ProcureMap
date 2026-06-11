# ProcureMap

ProcureMap turns a location, material, and search radius into a procurement supplier map. It uses the internal Xila/Corevo data interfaces, enriches the nearest suppliers, and renders the same interactive HTML style as `参考.html`.

## Desktop App

Run the local app:

```bash
python3 procuremap_app.py
```

The app opens `http://127.0.0.1:8765`, lets the user enter an origin, material, keywords, radius, and enrichment size, then shows progress while the analysis runs. The final result is saved under `outputs/` and can be opened directly in the browser.

## CLI

```bash
python3 procuremap_cli.py \
  --origin 芜湖永康 \
  --lat 31.35246 \
  --lng 118.43313 \
  --material 铝 \
  --radius 300 \
  --enrich-limit 20
```

Useful options:

- `--keywords`: comma-separated material keywords, for example `铝,铝业,铝材,铝合金,铝型材`.
- `--areas`: comma-separated nearby areas used to shape search queries.
- `--max-details`: maximum companies to fetch detail pages for.
- `--enrich-limit`: nearest companies to enrich with risk, news, patents, bids, contacts, and related dimensions.
- `--internal-token`: Xila/Corevo internal service token. If omitted, the tool reads `INSIGHT_INTERNAL_SERVICE_TOKEN`; in the dev environment it can also resolve the token from `ssh moss-dev`.

## Release

Every pushed tag triggers `.github/workflows/release.yml`. The workflow builds `ProcureMap.exe` on Windows with PyInstaller, uploads the ZIP artifact, and attaches it to the GitHub release.
