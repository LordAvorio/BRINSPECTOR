# Spec Delta

## Purpose

Turns a captured session into a downloadable PDF that a tester can hand to developers as complete bug evidence with AI-suggested fixes.

## ADDED Requirements

### Requirement: Generate report from the popup
The popup SHALL provide a Generate Report action for the active tab's session and for each recent session. The popup SHALL let the tester add optional incident notes (up to 500 characters) before generating. While generating, the popup SHALL show progress; generation SHALL be disabled for empty sessions.

#### Scenario: Generate with notes
- **WHEN** the tester enters notes and clicks Generate Report
- **THEN** a PDF is produced that includes the notes

#### Scenario: Empty session
- **WHEN** the active session has no events
- **THEN** Generate Report is disabled

### Requirement: Report content and structure
The PDF SHALL contain: a summary (origin, time range, counts of errors, AI-detected issues, network events, screenshots, redacted values), the incident notes, and the events grouped by page URL in chronological order. Each issue SHALL show its classification, details (method, URL, status, duration, truncated redacted bodies for network; message and stack for runtime errors), its linked screenshot or "screenshot unavailable", and the AI suggestion when available. `ok` network events not flagged by AI SHALL be listed compactly without bodies. The report SHALL state that redaction is best-effort.

#### Scenario: Error with screenshot and suggestion
- **WHEN** the session contains a 500 response with a screenshot and an AI suggestion
- **THEN** the PDF shows the request details, the screenshot, and the suggested fix under that response's URL group

#### Scenario: Successful requests listed
- **WHEN** the session contains successful GET requests
- **THEN** they appear in the PDF as compact entries without bodies

### Requirement: Report is downloaded as a file
The report SHALL be saved as a PDF file named with the origin host and a timestamp. Captured text SHALL appear as selectable text, not images.

#### Scenario: Download
- **WHEN** generation completes
- **THEN** a file such as `brinspector-app.example.com-20260929-1430.pdf` is downloaded

### Requirement: Generation failure handling
If PDF generation fails, the popup SHALL show the failure with a retry action and SHALL offer exporting the redacted session as JSON as a fallback.

#### Scenario: Retry after failure
- **WHEN** PDF generation fails
- **THEN** the popup shows the error with Retry and "Export JSON" actions

### Requirement: Post-generation session handling
After a report of the active session is generated, the popup SHALL ask whether to start a new session; choosing yes SHALL clear the session, choosing no SHALL keep it. A report generated from a recent session SHALL delete that recent session.

#### Scenario: Start new session
- **WHEN** the report is downloaded and the tester chooses to start a new session
- **THEN** the active session is cleared
