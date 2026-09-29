# Spec Delta

## Purpose

Lets a tester opt a specific website origin into automatic monitoring from the extension popup, so that capture only ever runs on sites the tester explicitly chose.

## ADDED Requirements

### Requirement: Per-origin monitoring toggle
The popup SHALL show a "Monitor this site" toggle for the origin (scheme, host, and port) of the active tab. The toggle SHALL reflect whether that exact origin is currently monitored. The toggle SHALL be disabled for pages whose scheme is not `http` or `https`.

#### Scenario: Toggle shows current state
- **WHEN** the tester opens the popup on a tab whose origin is monitored
- **THEN** the toggle is shown in the ON state

#### Scenario: Unsupported page
- **WHEN** the tester opens the popup on a `chrome://` page
- **THEN** the toggle is disabled and the popup explains that the page cannot be monitored

### Requirement: Host access is requested only on opt-in
The extension MUST NOT hold host access to any website origin at install time. When the tester turns the toggle ON, the extension SHALL request host access for that exact origin only. If the tester denies the request, the origin SHALL remain unmonitored.

#### Scenario: Tester grants access
- **WHEN** the tester turns the toggle ON and approves the browser permission prompt
- **THEN** the origin is added to the monitored sites and the toggle shows ON

#### Scenario: Tester denies access
- **WHEN** the tester turns the toggle ON and denies the browser permission prompt
- **THEN** the origin is not monitored and the toggle returns to OFF

### Requirement: Automatic capture on monitored origins
Once an origin is monitored, capture SHALL start automatically on every page load of that origin in any tab, from the start of the document, without further tester action. Monitoring SHALL persist across browser restarts.

#### Scenario: Revisiting a monitored site
- **WHEN** the tester opens a new tab to a monitored origin
- **THEN** network and console capture is active from the first request of the page

#### Scenario: Unmonitored site
- **WHEN** the tester browses an origin that is not monitored
- **THEN** no data from that origin is captured

### Requirement: Reload prompt on first activation
When the toggle is turned ON for the origin of an already-loaded tab, the popup SHALL inform the tester that earlier activity was not captured and SHALL offer a reload action. The extension MUST NOT reload the tab without the tester's confirmation.

#### Scenario: Tester accepts reload
- **WHEN** the tester turns monitoring ON and clicks the offered reload action
- **THEN** the tab reloads and capture covers the page from its first request

### Requirement: Turning monitoring off
Turning the toggle OFF SHALL stop capture for that origin on subsequent page loads and SHALL release the host access granted for it. The popup SHALL list all monitored origins and allow removing any of them.

#### Scenario: Remove a monitored site
- **WHEN** the tester removes an origin from the monitored sites list
- **THEN** the origin is no longer monitored and the extension no longer holds host access to it
