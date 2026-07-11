# TimeManage App Privacy Draft

This document is a technical inventory for the App Store Connect privacy questionnaire. The Account Holder must confirm the final answers and publish a public privacy policy.

## Data linked to the user

- Contact information: login email address or mobile number.
- User identifiers: platform account ID, workspace membership ID, device ID, and authentication token.
- User content: workspace names, projects, tasks, schedules, progress notes, work sessions, and focus sessions.

Purpose: app functionality, account authentication, team collaboration, synchronization, and data integrity. The application does not use these fields for third-party advertising or cross-company tracking.

## Operational data

- Server access logs may contain IP address, request time, route, response status, and diagnostic details.
- Local application storage contains the selected server URL, remembered account identifier, preferences, and session state.

## Tracking and third parties

- No advertising SDK or third-party tracking SDK is present in the current native project.
- `NSPrivacyTracking` is declared as false.
- Before submission, verify the production server retention policy and every transitive native dependency.

## Human confirmation required

- Public privacy policy URL.
- Log retention period and deletion process.
- Account deletion/contact process.
- Whether production analytics or monitoring services collect additional identifiers.
