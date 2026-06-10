# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a single-context documentation layout:

- `CONTEXT.md` at the repo root for project domain language.
- `docs/adr/` for architectural decision records.

If either location does not exist yet, proceed silently. The producer skills create them lazily when terms or decisions actually get resolved.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if present.
- Relevant ADRs under `docs/adr/`, if present.

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`.

If the concept is not in the glossary yet, note the gap for a later `/grill-with-docs` pass rather than inventing new vocabulary casually.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
