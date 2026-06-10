# Issue Tracker: GitHub

Issues and PRDs for this repo live in GitHub Issues:

- Repository: `hushengjie666/team_progress_manage`
- URL: `https://github.com/hushengjie666/team_progress_manage`

Use the `gh` CLI for issue operations. Because this local directory currently has no Git metadata, pass the repository explicitly with `-R hushengjie666/team_progress_manage`.

## Conventions

- Create an issue: `gh issue create -R hushengjie666/team_progress_manage --title "..." --body "..."`
- Read an issue: `gh issue view -R hushengjie666/team_progress_manage <number> --comments`
- List issues: `gh issue list -R hushengjie666/team_progress_manage --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment -R hushengjie666/team_progress_manage <number> --body "..."`
- Apply labels: `gh issue edit -R hushengjie666/team_progress_manage <number> --add-label "..."`
- Remove labels: `gh issue edit -R hushengjie666/team_progress_manage <number> --remove-label "..."`
- Close an issue: `gh issue close -R hushengjie666/team_progress_manage <number> --comment "..."`

Use heredocs for multi-line issue bodies.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `hushengjie666/team_progress_manage`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view -R hushengjie666/team_progress_manage <number> --comments`.
