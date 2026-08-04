# Rehearsal Regression Suite

This is a separate regression suite for the rehearsal tools.

## What this suite includes

- `cases/core-regression.json`: baseline key-feature regression checks.
- `cases/known-issues.json`: bug regressions you add as issues are found.
- `scripts/rehearsalSmokeChecks.js`: quick automated guard checks for critical wiring in `static/audio_rehearsal_workspace3-tts.html`.
- `scripts/rehearsalRegressionRunner.js`: prints a checklist and writes a timestamped run file.

## Commands

- `npm run test:rehearsal:smoke`
  - Fast automated checks for critical selectors/function hooks.
- `npm run test:rehearsal:list`
  - Lists all regression cases from `core-regression.json` and `known-issues.json`.
- `npm run test:rehearsal:run`
  - Generates a markdown checklist in `tests/rehearsal/runs/` for a manual run.

## Typical workflow

1. Run smoke checks first.
2. Generate a manual run checklist.
3. Test in the browser and mark pass/fail in the generated run file.
4. If you find a bug, add a case to `cases/known-issues.json` so it never regresses silently.

## Adding new issue regressions

1. Use `tests/rehearsal/ISSUE_CASE_TEMPLATE.md`.
2. Add a new case object under `cases/known-issues.json` -> `cases`.
3. Keep IDs unique (for example `ISSUE-001`, `ISSUE-002`).
4. Re-run `npm run test:rehearsal:list` to verify it is picked up.
