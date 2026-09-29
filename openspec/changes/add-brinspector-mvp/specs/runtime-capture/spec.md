# Spec Delta

## Purpose

Automatically records network activity and runtime errors on monitored pages, classifies each event, and delivers it to the extension without altering the page's own behavior.

## ADDED Requirements

### Requirement: Network capture
On monitored pages the extension SHALL record every request made via `fetch` and `XMLHttpRequest`, including: method, URL, request headers, request body (text only), response status, response headers, response body (text or JSON only), start time, and duration. Response bodies of non-text types SHALL be recorded as omitted. Bodies larger than the configured size limit SHALL be truncated and marked as truncated.

#### Scenario: JSON API call
- **WHEN** the page calls `fetch` and receives a JSON response
- **THEN** the event contains method, URL, status, duration, and the (redacted) JSON body

#### Scenario: Binary response
- **WHEN** the page fetches an image via `fetch`
- **THEN** the event is recorded with the body marked as omitted

#### Scenario: Oversized body
- **WHEN** a response body exceeds the size limit
- **THEN** only the leading portion up to the limit is stored and the event is marked truncated

### Requirement: Page behavior is preserved
Capture MUST NOT change what the page receives: responses, errors, timing semantics, and console output SHALL behave as without the extension. A failure inside the capture logic MUST NOT break the page's request or logging.

#### Scenario: Page reads the response body
- **WHEN** the page reads a response body that the extension also recorded
- **THEN** the page receives the complete, unmodified body

### Requirement: Runtime error capture
On monitored pages the extension SHALL record calls to `console.error`, uncaught exceptions, and unhandled promise rejections, including the message, stack trace when available, source location when available, and timestamp.

#### Scenario: Uncaught exception
- **WHEN** a script on the page throws an uncaught `TypeError`
- **THEN** an error event with the message and stack trace is recorded

#### Scenario: Unhandled rejection
- **WHEN** a promise on the page rejects without a handler
- **THEN** an error event with the rejection reason is recorded

### Requirement: Status-based classification
Each network event SHALL be classified as `error` when its status is outside 200–299 or the request failed without a status (network failure, CORS, timeout, abort), and as `ok` otherwise. Console errors, uncaught exceptions, and unhandled rejections SHALL be classified as `error`. Classification MUST NOT depend on the response body.

#### Scenario: Server error
- **WHEN** a request returns status 500
- **THEN** the event is classified `error`

#### Scenario: Created response
- **WHEN** a request returns status 201
- **THEN** the event is classified `ok`

#### Scenario: 200 with failure payload
- **WHEN** a request returns status 200 with body `{"success": false}`
- **THEN** the event is classified `ok` and kept for AI analysis

#### Scenario: CORS failure
- **WHEN** a request fails due to CORS
- **THEN** the event is classified `error` with the failure reason recorded

### Requirement: Validated delivery from page to extension
Events originating from the page context SHALL be accepted by the extension only if they carry the per-page secret established at initialization and match the expected event shape. Messages that fail validation SHALL be discarded.

#### Scenario: Forged message
- **WHEN** a page script posts a message imitating a capture event without the valid secret
- **THEN** the extension discards it and it does not appear in the session

### Requirement: Every event is labeled with its URL
Each captured event SHALL record the page URL at the time it occurred and the tab it came from.

#### Scenario: Event after SPA navigation
- **WHEN** an error occurs after the page changed its URL via history navigation
- **THEN** the event is labeled with the new URL
