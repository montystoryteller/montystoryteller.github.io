# Issue Regression Case Template

Use this template when you find a new bug and want to lock it into the regression suite.

## JSON object template

Add an object like this to `tests/rehearsal/cases/known-issues.json` under `cases`:

```json
{
  "id": "ISSUE-001",
  "title": "Short bug summary",
  "area": "loop-save",
  "type": "manual",
  "reported_on": "2026-08-04",
  "source": "manual-testing",
  "preconditions": [
    "State required before reproducing"
  ],
  "steps": [
    "Exact step 1",
    "Exact step 2"
  ],
  "expected": [
    "What should happen"
  ],
  "regression_of": "Optional reference (commit, note, issue id)"
}
```

## Good practices

- Keep each case focused on one bug.
- Use deterministic steps.
- Include the exact mode used (Repeat, Release, Frontier) where relevant.
- Prefer explicit expected outcomes over vague wording.
