# Loe.me

Créateur de rituels d’apprentissage. L’utilisateur exprime une intention (ex. « apprendre la couture en 14 jours ») ; le moteur de décision (V2) analyse, reformule, propose des angles ou des précisions, puis génère un rituel de missions.

Monorepo : app Next.js (`apps/web`) + packages partagés.

## Quick start

```bash
npm install
npm run dev
```

## Scripts utiles

- `npm run dev` – lance l’app web (toujours depuis la racine pour éviter les 404 sur les assets)
- `npm run dev:clean` – supprime le cache `.next` puis lance le dev (si 404 sur layout.css, page.css, main-app.js)
- `npm run build` – build de l’app web
- `npm run start` – serveur de production
- `npm run lint` – lint de l’app web
- `npm run lint:ui-rules` – vérifie règles UI / registre (si staged touche lib/decisionEngine, admin, prompts)
- `npm run format` – vérification Prettier
- `npm run format:write` – formatage des fichiers
- `npm run purge:data` – purge des données file-based (défaut 14 jours)

Purge avec TTL personnalisé :

```bash
DATA_TTL_DAYS=30 npm run purge:data
```

## Smoke tests

- `npm run smoke:sanity` – enchaîne lint + tous les smoke (taxonomy, playbooks, realism, ambition, rules, home-classify, lexicon, db, prompts, decision-engine, audience-safety, tone, copy-variant, fingerprint, eval)
- `npm run smoke:fingerprint` – vérifie que des intentions équivalentes partagent la même empreinte
- `npm run smoke:decision-engine` – moteur de décision V2
- `npm run smoke:db` – store décisions / indexes
- `npm run smoke:prompts` – catalogue de prompts
- Autres : `smoke:realism`, `smoke:ambition`, `smoke:rules`, `smoke:home-classify`, `smoke:lexicon`, `smoke:eval`, etc.

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) – vision produit et état actuel
- [docs/decision-engine-v2-analysis.md](docs/decision-engine-v2-analysis.md) – spec et statut du moteur de décision V2
- [docs/eval-harness.md](docs/eval-harness.md) – harness d’évaluation (scénarios, Admin → Eval)
- [docs/dev-note-category-pipeline.md](docs/dev-note-category-pipeline.md) – pipeline catégorie / actionability

## Mission (rituel)

- Génération du rituel → stubs visibles avec vrais titres (pas « Mission 1 »)
- Clic sur un step sans blocks → « Generating this mission… » puis mission s’ouvre
- Après « Complete » → préfetch uniquement la suivante (N+1)
- Rechargement `/ritual/[id]` → persistance OK (stubs + missionsById)

Missions générées à la demande :

- `/api/missions/generate` retourne le chemin complet et le contenu de la première mission ; les autres en stubs.
- `/api/missions/generate-one` remplit les blocks d’une mission donnée.
- Le client précharge la mission N+1 après complétion.
