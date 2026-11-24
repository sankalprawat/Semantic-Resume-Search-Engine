# Agent Refactoring Guardrails
- Always read target files and their direct imports before editing.
- Do NOT create new files, wrapper abstractions, or rename exported functions/interfaces unless explicitly instructed.
- Preserve all existing FastAPI routes, Pydantic schemas, and React component prop types.
- After backend edits, run `cd backend && pytest` and revert if any test fails.
- After frontend edits, run `cd frontend && npm run build` and revert if the build fails.