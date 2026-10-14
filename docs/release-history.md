# TimeManage Team Release History

## v0.2.12

- Adds quick task creation from the focus page, including workspace and project selection, draft preservation, and retrying a failed queue addition without creating duplicate tasks.
- Improves task notifications and project headings, updates the application icon, and fixes timer completion reminders and desktop error recovery.
- Includes the relational business storage introduced in the 0.2.11 temporary builds and the fixes for project creation and settings confirmation races.
- Release contract: release `0.2.12`, API protocol `2`, schema `15`, minimum client `0.2.12`.
- Migration `00015_v0_2_12_noop.sql` is reversible and does not modify business data. Existing schema 14 SQL remains unchanged.
- Build the unified desktop, iOS, Web, and server package from the immutable annotated `v0.2.12` tag with `npm run release:team:tag -- v0.2.12`.

## Legacy deployed package: 2026-07-01 01:58

This is the package currently reported as deployed on the Windows server:

```text
timemanageTeam-no-root.zip
```

Local reference checked on 2026-07-01:

```text
/Users/hushengjie/Desktop/timemanageTeam-no-root.zip
sha256 d1f9aade2b1df3e631c0ba2f741b8c01ba4544547a576959b5709b1e2d56e8d8
```

Archive layout:

```text
web/
server/backend.json
server/backend.example.json
server/timemanage-team.exe
server/start-backend.bat
server/stop-backend.bat
server/install-windows-service.ps1
```

Git note:

There is no source-exact Git tag for this artifact because the repository has no commit at the package build time. The closest visible commit in the repository around that period is:

```text
34b5dea05611896a98762a74b6f7aacecb7219f2
2026-06-30 15:11:06 +0800
Complete system workflow and MySQL backend
```

Do not use that commit as a source-exact tag for the deployed zip unless separately verified. From the next formal release onward, create an annotated Git tag first and build the deployment package from that tag.
