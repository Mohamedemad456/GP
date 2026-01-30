# Repository Conventions

This document defines naming and workflow conventions for GitHub usage in this
repository. Follow these rules to keep history clean and collaboration smooth.

## Branch naming
- Format: `<type>/<jira-ticket-id>-<short-description>`
- Use lowercase and hyphens.
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`
- Examples:
  - `feat/GDP-1-add-login-form`
  - `fix/GDP-3-navbar-overflow`
  - `docs/GDP-4-react-query-usage`

## Commit messages
- Format: `<type>(service): <summary>`
- Use present tense, imperative mood.
- Keep summary under 72 characters.
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
- Examples:
  - `feat(frontend): add signup page`
  - `fix(backend): handle empty search results`
  - `docs(ai): document react query usage`

## Pull requests
- Title format: `<type>: <summary>`
- Keep titles short and specific.
- PR description must include:
  - Summary of changes
  - Testing performed
  - Related issues or tickets (if any)
- Example title: `feat: add profile settings page`

## Merge strategy
- Prefer squash-merge for feature branches.
- Ensure CI passes before merging.
- Rebase local branch before opening a PR if it helps reduce conflicts.
