# Loe.me Mission Engine V1

Monorepo with a Next.js app and shared packages.

## Quick start

```bash
npm install
npm run dev
```

## Useful scripts

- `npm run dev` – start the web app
- `npm run build` – build the web app
- `npm run start` – run the production server
- `npm run lint` – lint the web app
- `npm run format` – check formatting
- `npm run format:write` – format files
- `npm run purge:data` – purge old file-based data (default 14 days)

Purge with a custom TTL:

```bash
DATA_TTL_DAYS=30 npm run purge:data
```

## Mission sanity checklist

- Generation ritual → stubs visibles avec vrais titres (pas “Mission 1”)
- Clic sur un step sans blocks → “Generating this mission…” puis mission s’ouvre
- Après “Complete” → préfetch uniquement la suivante (N+1)
- Reload page `/ritual/[id]` → persistence OK (stubs + missionsById)

## Mission lazy generation

Missions are generated lazily:

- `/api/missions/generate` returns the full path plus only the first mission content.
- Other missions are returned as stubs (no blocks).
- `/api/missions/generate-one` fills the blocks for a single mission on demand.
- The client keeps one mission ahead by preloading the next available mission after completion.
