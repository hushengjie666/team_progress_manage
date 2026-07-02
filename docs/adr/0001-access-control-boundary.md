# ADR 0001: Access Control Boundary

## Status

Accepted.

## Context

The app used to derive project, workspace, and member visibility in several UI and domain modules. That made small feature changes slow because each screen could apply a slightly different rule.

The legacy `TeamMember` entity also overlapped with platform accounts, workspace memberships, and project members. New code that kept creating `TeamMember` records made ownership and visibility bugs more likely.

## Decision

`src/accessControl.ts` is the single frontend boundary for permission and visibility rules.

Code that needs to answer one of these questions must use that module instead of rebuilding the rule locally:

- Which workspaces can this account access?
- Which projects can this account see?
- Which tasks can this account see?
- Who counts as a workspace member?
- Who counts as a project member?
- Can this account manage workspace or project members?
- Can this account review project tasks?

New feature code must treat these records as the canonical member model:

- `Account`: login identity.
- `WorkspaceMembership`: access to every project in one workspace.
- `ProjectMember`: access to one project only, with project roles.

`TeamMember` is a legacy compatibility record. It may be read to hydrate old data, resolve older project bindings, or keep old sync rows importable. New project and project-member write paths should not create `TeamMember` records. When `accountId` is available, new project-member rows should not write `teamMemberId`.

## Consequences

Permission changes should usually touch `src/accessControl.ts` and its tests first, then page code should consume the derived model.

Old data remains readable through compatibility adapters, but the app should stop increasing the legacy `TeamMember` surface.

Before removing the backend `team_member` table or old sync entity completely, add a database migration that backfills account and project-member identity fields, plus a rollback migration that can recreate old rows from the canonical data.
