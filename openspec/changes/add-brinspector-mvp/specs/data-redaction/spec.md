# Spec Delta

## Purpose

Prevents sensitive values such as credentials, tokens, and personal identifiers from ever being stored, sent to AI, or written into reports by masking them at capture time.

## ADDED Requirements

### Requirement: Redaction happens before storage
Every captured event SHALL be redacted before it is persisted. Unredacted values MUST NOT be written to extension storage, sent to the AI service, or included in a report.

#### Scenario: Stored event contains no raw token
- **WHEN** a request carrying `Authorization: Bearer abc123` is captured
- **THEN** the stored event contains a redaction marker instead of `abc123`

### Requirement: Sensitive headers are masked
Values of the headers `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, and any header whose name contains `token` or `secret` (case-insensitive) SHALL be replaced with a redaction marker.

#### Scenario: Cookie header
- **WHEN** a response includes a `Set-Cookie` header
- **THEN** its value is stored as a redaction marker

### Requirement: Sensitive JSON fields are masked
In JSON and form-encoded request and response bodies and in URL query parameters, at any nesting depth, values of sensitive keys SHALL be replaced with a redaction marker. A key is sensitive when it contains (case-insensitive) `password`, `passcode`, `passwd`, `token`, or `secret`, or when one of its words (split on camelCase, `_`, `-`) is `pass`, `pin`, `otp`, `cvv`, or `cvc`.

#### Scenario: Word match avoids false positives
- **WHEN** a body contains the key `shipping`
- **THEN** its value is not masked as sensitive

#### Scenario: Nested password field
- **WHEN** a request body is `{"user": {"name": "a", "password": "x"}}`
- **THEN** the stored body is `{"user": {"name": "a", "password": "[REDACTED:secret]"}}`

### Requirement: Sensitive value patterns are masked
In all captured text (URLs, headers, bodies, console messages), values matching a payment card number (13–19 digits, optionally separated by spaces or dashes, starting with 2–6 and passing the Luhn check), a 16-digit national identity number (NIK, with a valid province code and birth date segment), an email address, or a phone number SHALL be replaced with a type-labeled redaction marker.

#### Scenario: Timestamps are kept
- **WHEN** a body contains the millisecond timestamp `1727600000000`
- **THEN** it is not masked

#### Scenario: Card number in console message
- **WHEN** the page logs `console.error("charge failed for 4111111111111111")`
- **THEN** the stored message contains `[REDACTED:card]` instead of the number

#### Scenario: Non-card long number
- **WHEN** a body contains a 16-digit number that fails the Luhn check and is not in a sensitive field
- **THEN** it is masked as a NIK, not as a card

### Requirement: Redaction is visible to the tester
Each event SHALL record how many values were redacted, and the popup and report SHALL show the total. The report SHALL state that redaction is best-effort.

#### Scenario: Redaction count shown
- **WHEN** a session contains events with 12 redacted values in total
- **THEN** the popup shows that 12 values were redacted
