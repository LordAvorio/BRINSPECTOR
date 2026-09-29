# Spec Delta

## Purpose

Uses an Azure AI Foundry model at report time to explain each issue, suggest a fix, and detect requests that returned success status but actually failed.

## ADDED Requirements

### Requirement: AI is invoked only on report generation
The extension SHALL call the AI service only when the tester generates a report. Captured data MUST NOT be sent to the AI service at any other time.

#### Scenario: Browsing without generating
- **WHEN** the tester browses a monitored site and never generates a report
- **THEN** no request is made to the AI service

### Requirement: Bounded, redacted payload
The AI request SHALL contain only redacted data and SHALL include: all `error` events, all `POST`/`PUT`/`PATCH`/`DELETE` events, `GET` events deduplicated by method, URL path, and status, and the tester's incident notes. Bodies SHALL be truncated to the configured AI body limit.

#### Scenario: Repeated polling request
- **WHEN** the session contains 50 identical `GET /api/status` 200 events
- **THEN** the AI request includes that request once

### Requirement: Structured suggestion per issue
The AI response SHALL be requested in a structured format and SHALL provide, for each analyzed event: the event identifier, whether it is a hidden failure, the likely root cause, a suggested fix, and a severity of `critical`, `high`, `medium`, or `low`. Responses that do not match the structure SHALL be treated as an AI failure.

#### Scenario: Error event analyzed
- **WHEN** the report includes a 500 response
- **THEN** the report shows a root cause, suggested fix, and severity for it

### Requirement: Hidden failure detection
Events classified `ok` that the AI marks as hidden failures SHALL be presented in the report as issues, visibly labeled as AI-detected.

#### Scenario: 200 with validation error
- **WHEN** a `POST` returned status 200 with body `{"success": false, "message": "Saldo tidak cukup"}` and the AI marks it as a hidden failure
- **THEN** the report lists it as an AI-detected issue with its screenshot and suggested fix

### Requirement: Graceful AI failure
If the AI service is unreachable, times out, rejects the request, or returns an invalid structure, the report SHALL still be generated without AI suggestions, and the tester SHALL be told that AI suggestions are unavailable and why.

#### Scenario: AI timeout
- **WHEN** the AI service does not respond within the timeout
- **THEN** the PDF is produced without suggestions and the popup shows that AI suggestions were unavailable

### Requirement: AI credentials are build-time configuration
The AI endpoint, deployment, and key SHALL be provided through build-time environment configuration and MUST NOT be committed to source control. If configuration is missing, report generation SHALL proceed without AI and inform the tester.

#### Scenario: Missing key
- **WHEN** the extension was built without an AI key
- **THEN** reports are generated without AI suggestions and the popup states AI is not configured
