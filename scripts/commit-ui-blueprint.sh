#!/bin/bash
# Exécute les 5 commits UI blueprint dans l'ordre (sans confirmation).
# Usage: ./scripts/commit-ui-blueprint.sh
set -e
cd "$(dirname "$0")/.."

echo "1/5 feat(tokens)..."
git add packages/ui/src/tokens.json packages/ui/src/tokens.ts packages/ui/tsconfig.json packages/ui/package.json
git commit -m "feat(tokens): add tokens.json as single source, export TS + CSS vars + package exports"

echo "2/5 feat(ui-components)..."
git add packages/ui/src/styles.css packages/ui/src/components.tsx
git commit -m "feat(ui-components): add Button, Card, Tabs using tokens only + dark theme structure"

echo "3/5 refactor(ui-migrate-1-screen)..."
git add apps/web/app/page.tsx apps/web/app/components/RitualHistory.tsx
git commit -m "refactor(ui-migrate-1-screen): migrate Home CTA and RitualHistory to @loe/ui Button/Tabs"

echo "4/5 docs(ui-blueprint)..."
git add docs/ui-audit.md docs/ui-blueprint.md
git commit -m "docs(ui-blueprint): add audit and UI blueprint for tokens + components"

echo "5/5 chore(lint-rules)..."
git add scripts/lint-ui-rules.mjs package.json apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "chore(lint-rules): add lint:ui-rules script, import @loe/ui/styles.css in layout, pragmatic lint"

echo "Done."
