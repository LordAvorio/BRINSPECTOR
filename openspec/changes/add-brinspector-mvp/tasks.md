# Tasks

## 1. Project Setup

- [x] 1.1 Scaffold a WXT + TypeScript + React extension project in the repo root (popup, background, content entrypoints) and verify `npm run build` produces a loadable MV3 extension in `.output/chrome-mv3`
- [x] 1.2 Configure Tailwind with the color, typography, and radius tokens from `docs/DESIGN.md` and verify a popup element styled with a token class renders with the expected color in the build
- [x] 1.3 Configure the manifest (`storage`, `scripting`, `tabs`, `unlimitedStorage` permissions; `optional_host_permissions` for `http://*/*` and `https://*/*`; host permission for the Foundry endpoint from env) and verify the built `manifest.json` contains no mandatory website host permissions
- [x] 1.4 Add `.gitignore` entries for `.env*` (except `.env.example`), `.output`, `.wxt`, `node_modules`, add `.env.example` with the Foundry variables, and verify `git status` does not list a local `.env`
- [x] 1.5 Set up Vitest with WXT's fake browser and verify `npm test` runs a placeholder test

## 2. Shared Model, Redaction, and Classification

- [x] 2.1 Define the capture event, session, and screenshot types plus a constants module for all limits (body size, ring buffer, TTL, idle window, max wait, AI body limit) and verify the project type-checks
- [x] 2.2 Implement header, JSON-key, and value-pattern redaction (card with Luhn, NIK, email, phone) with redaction counts, and verify unit tests cover every scenario in `specs/data-redaction/spec.md`
- [x] 2.3 Implement status-based classification and verify unit tests cover 200, 201, 404, 500, status 0 failures, and runtime errors per `specs/runtime-capture/spec.md`

## 3. Storage and Session Management

- [x] 3.1 Implement the IndexedDB store (sessions, events, screenshots) and verify tests with an in-memory IndexedDB can write and read events and screenshots
- [x] 3.2 Implement the session manager (per-tab active session, continuation across navigation, Clear, ring buffer limits with "screenshot discarded" marking) and verify unit tests for each requirement in `specs/session-management/spec.md`
- [x] 3.3 Implement tab-close handling into recent sessions (30-minute TTL, max 3) and startup purge that keeps monitored-site settings, and verify tests for accidental close, expiry, eviction, and restart

## 4. Site Monitoring

- [x] 4.1 Implement origin helpers (derive origin from URL, reject non-http(s)) and verify unit tests
- [x] 4.2 Implement enable/disable monitoring in the background: request/remove host permission for the exact origin, register/unregister the MAIN and ISOLATED content scripts (`document_start`, persistent), and persist the monitored list; verify tests with the fake browser for grant, deny, and removal
- [x] 4.3 Re-sync content script registrations with the monitored list on install/startup and verify a test where a stored origin gets its scripts registered

## 5. Runtime Capture

- [x] 5.1 Implement the MAIN-world `fetch` hook (clone response, text/JSON bodies only, truncation, failure capture) and verify tests that the page still receives the full unmodified body and that hook errors do not break requests
- [x] 5.2 Implement the MAIN-world `XMLHttpRequest` hook with the same guarantees and verify equivalent tests
- [x] 5.3 Implement `console.error`, uncaught exception, and unhandled rejection capture that preserves original console output, and verify tests for each
- [x] 5.4 Implement the nonce-validated bridge (ISOLATED relay → background) including pending-request tracking and URL labeling, and verify a test that forged or malformed messages are discarded
- [x] 5.5 Implement background ingest (validate → redact → classify → persist) and verify a test that a raw event with an `Authorization` header is stored redacted and classified

## 6. Screenshot Capture

- [x] 6.1 Implement the trigger scheduler (error events, mutating requests, manual; not ok GETs), idle-window wait with max wait, and debounce linking all triggering events, and verify fake-timer tests for each scenario in `specs/screenshot-capture/spec.md`
- [x] 6.2 Implement capture via `captureVisibleTab` (JPEG) with "screenshot unavailable" marking when the tab is not visible or capture fails, and verify tests with the fake browser
- [x] 6.3 Implement the "Capture now" background handler that records a manual event with a screenshot and verify a test

## 7. AI Fix Suggestion

- [x] 7.1 Implement the AI payload builder (errors, mutating events, deduplicated GETs, truncated bodies, incident notes) and verify tests for dedup and truncation
- [x] 7.2 Implement the Foundry client (chat completions with JSON schema output, timeout, response validation, missing-config handling) and verify tests with mocked `fetch` for success, timeout, invalid structure, and missing key
- [x] 7.3 Merge AI results into report data (suggestions per event, hidden failures promoted to AI-detected issues) and verify a test with a 200 `{"success": false}` POST

## 8. PDF Report

- [x] 8.1 Implement the report document builder (summary, notes, URL groups, issue details, screenshots, AI suggestions, compact ok list, best-effort redaction note) and verify tests on the generated document definition
- [x] 8.2 Implement PDF rendering and download with the `brinspector-<host>-<yyyyMMdd-HHmm>.pdf` filename, plus the redacted JSON export fallback, and verify tests for filename and JSON content
- [x] 8.3 Implement the generate-report orchestration (load session → AI → PDF → download, progress events, recent session deletion after report) and verify a test that AI failure still yields a PDF with a notice

## 9. Popup UI

- [x] 9.1 Build the popup shell and monitoring section (toggle, disabled state for unsupported pages, reload prompt, monitored sites list with remove) and verify component tests
- [x] 9.2 Build the session timeline (grouped by URL, classification badges, counts, redaction total, text-only rendering) and verify a component test that captured markup is shown literally
- [x] 9.3 Build actions: Capture now, Clear, incident notes (500 chars), Generate Report with progress, failure state with Retry and Export JSON, AI-unavailable notice, post-generation "start new session" prompt, and recent sessions list; verify component tests for empty-session disabling and failure state

## 10. Integration and Documentation

- [x] 10.1 Write `README.md` covering setup, `.env` configuration, key mitigations (dedicated resource, quota, rotation, do not share builds), building, loading unpacked, and known limitations; verify the documented commands run as written
- [x] 10.2 Run the full test suite, type-check, and production build and verify all pass
