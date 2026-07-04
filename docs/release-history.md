# TimeManage Team Release History

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
