# Spec Delta

## Purpose

Groups captured evidence into short-lived per-tab sessions that survive navigation and accidental tab closing, while keeping stored data bounded and minimal.

## ADDED Requirements

### Requirement: One active session per monitored tab
A session SHALL start when a tab first loads a monitored origin and SHALL continue across reloads and navigations within that tab. All events from that tab SHALL belong to its active session.

#### Scenario: Navigation keeps the session
- **WHEN** the tester navigates from `/login` to `/dashboard` in the same monitored tab
- **THEN** events from both pages appear in the same session

#### Scenario: Separate tabs
- **WHEN** the tester tests the same monitored origin in two tabs
- **THEN** each tab has its own session

### Requirement: Session timeline in the popup
The popup SHALL show the active tab's session as a timeline grouped by page URL, with counts of error events, network events, and screenshots. All captured content SHALL be rendered as plain text.

#### Scenario: Timeline view
- **WHEN** the tester opens the popup on a monitored tab with captured events
- **THEN** events are listed grouped by URL with their classification

#### Scenario: Captured markup is not executed
- **WHEN** a captured response body contains `<img src=x onerror=alert(1)>`
- **THEN** the popup displays it as literal text and no script runs

### Requirement: Clear session
The popup SHALL provide a Clear action that permanently deletes all data of the active tab's session and starts a new empty session.

#### Scenario: Tester clears
- **WHEN** the tester clicks Clear
- **THEN** the session's events and screenshots are deleted and the timeline is empty

### Requirement: Recently closed sessions
When a tab with a session is closed, its session SHALL be kept as a recent session for a limited time (default 30 minutes), during which a report can still be generated from the popup. At most 3 recent sessions SHALL be kept; older ones SHALL be deleted first. Expired recent sessions SHALL be deleted.

#### Scenario: Accidental close
- **WHEN** the tester closes a monitored tab and reopens the popup within 30 minutes
- **THEN** the closed session is listed and a report can be generated from it

#### Scenario: Expiry
- **WHEN** a recent session is older than 30 minutes
- **THEN** it and its data are deleted

### Requirement: Bounded storage
Each session SHALL keep at most the configured number of network events (default 300) and screenshots (default 30); when a limit is exceeded, the oldest items of that kind SHALL be discarded.

#### Scenario: Screenshot limit reached
- **WHEN** a 31st screenshot is taken in a session
- **THEN** the oldest screenshot is discarded and its events are marked "screenshot discarded"

### Requirement: No data survives a browser restart
On browser startup the extension SHALL delete all session data. Monitored-site settings SHALL be preserved.

#### Scenario: Restart
- **WHEN** the browser is restarted
- **THEN** no sessions exist and monitored sites remain configured

### Requirement: Durable against extension background suspension
Captured events SHALL be persisted as they arrive so that suspension of the extension's background process does not lose captured data.

#### Scenario: Background restarted mid-session
- **WHEN** the extension background process is suspended and restarted during a session
- **THEN** all previously captured events are still present in the session
