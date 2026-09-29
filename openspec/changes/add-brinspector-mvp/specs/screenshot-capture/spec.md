# Spec Delta

## Purpose

Produces visual evidence of what the tester saw at the moment something went wrong or data was submitted, by taking viewport screenshots on meaningful events.

## ADDED Requirements

### Requirement: Event-triggered screenshots
On monitored tabs the extension SHALL take a viewport screenshot when any of the following occurs: a network event classified `error`, a runtime error event, completion of a `POST`, `PUT`, `PATCH`, or `DELETE` request regardless of status, or the tester pressing "Capture now". `GET` requests classified `ok` MUST NOT trigger a screenshot.

#### Scenario: Failed request
- **WHEN** a request on a monitored tab returns status 500
- **THEN** a screenshot is taken and linked to that event

#### Scenario: Form submit succeeding with validation message
- **WHEN** a `POST` request returns status 200
- **THEN** a screenshot is taken and linked to that event

#### Scenario: Successful GET
- **WHEN** a `GET` request returns status 200
- **THEN** no screenshot is taken

### Requirement: Screenshot waits for the page to settle
After a trigger, the screenshot SHALL be taken once the tab has had no pending `fetch`/`XMLHttpRequest` requests for the idle window, or when the maximum wait elapses, whichever comes first.

#### Scenario: Error message renders after response
- **WHEN** a request fails and the page shows an error banner shortly after
- **THEN** the screenshot is taken after the page is idle and shows the banner

### Requirement: Triggers are debounced
Triggers occurring while a screenshot is pending SHALL share that single screenshot, and every triggering event SHALL be linked to it.

#### Scenario: Burst of errors
- **WHEN** three requests fail within the same wait window
- **THEN** one screenshot is taken and linked to all three events

### Requirement: Unavailable screenshots are recorded
If the tab is not the visible active tab of its window when the screenshot is due, or the capture fails, the triggering events SHALL be marked "screenshot unavailable" and SHALL still be kept.

#### Scenario: Tester switched tabs
- **WHEN** an error occurs on a monitored tab while the tester is viewing another tab
- **THEN** the error is recorded and marked "screenshot unavailable"

### Requirement: Manual capture
The popup SHALL provide a "Capture now" action for the active monitored tab that takes a screenshot and records it as a manual event.

#### Scenario: Tester captures manually
- **WHEN** the tester clicks "Capture now"
- **THEN** a manual event with a screenshot of the current viewport is added to the session
