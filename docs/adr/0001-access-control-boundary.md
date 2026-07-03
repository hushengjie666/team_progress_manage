# ADR 0001: Access Control Boundary

## Status

Accepted.

## Context

The app used to derive project, workspace, and member visibility in several UI and domain modules. That made small feature changes slow because each screen could apply a slightly different rule.

The old member identity model overlapped with platform accounts, workspace memberships, and project members. New code that kept creating a fourth member record made ownership and visibility bugs more likely.

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

New code must not add another member identity model or cross-link alias beside these three records.

## Consequences

Permission changes should usually touch `src/accessControl.ts` and its tests first, then page code should consume the derived model.

Old compatibility rows are outside the canonical team API. Any future import of pre-removal data should be handled as an explicit migration task instead of reintroducing runtime compatibility paths.
