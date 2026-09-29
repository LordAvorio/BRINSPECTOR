# BRINSPECTOR

Chrome extension (Manifest V3) that helps testers find bugs in web apps. On sites you opt in to, it automatically captures network calls (fetch/XHR, including response bodies), console errors, uncaught exceptions, and event-triggered screenshots. It then generates a PDF report with AI fix suggestions from Azure AI Foundry. The AI also flags requests that returned HTTP 200 but actually failed.

## Requirements

- Node.js 20+ and npm
- Google Chrome
- An Azure AI Foundry / Azure OpenAI chat model deployment that supports structured outputs (`json_schema`). This is optional: without it, reports are generated without AI suggestions.

## Setup

```powershell
npm install
Copy-Item .env.example .env   # then fill in the values
```

`.env` variables:

| Variable | Meaning |
|---|---|
| `WXT_FOUNDRY_ENDPOINT` | Resource base URL, e.g. `https://my-resource.openai.azure.com`, or a full chat-completions URL |
| `WXT_FOUNDRY_DEPLOYMENT` | Deployment name (not needed when the endpoint is a full chat-completions URL) |
| `WXT_FOUNDRY_API_VERSION` | Defaults to `2024-10-21` |
| `WXT_FOUNDRY_API_KEY` | API key of the resource |

### Handling the API key

These values are **embedded into the build output** at build time, so anyone who has the `.output/` folder can read the key. For the hackathon:

- Use a **dedicated Foundry resource/deployment** for this project, with a **token/rate quota** set.
- **Do not share builds** (zip/crx) outside the team laptops, and never publish to the Chrome Web Store with a key inside.
- **Rotate (regenerate) the key** after the event.
- `.env` and `.output/` are git-ignored; keep it that way.

## Build and load

```powershell
npm run build        # production build -> .output/chrome-mv3
npm run dev          # development with auto-reload
```

To load the extension in Chrome:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select `.output/chrome-mv3`.
3. Pin BRINSPECTOR to the toolbar.

## Usage

1. Open the site under test, click the BRINSPECTOR icon, and turn on **Monitor situs ini**. Approve the permission prompt, then click **Muat ulang** so capture starts from the first request.
2. Run your test scenario as usual. Capture is automatic, with no Scan button:
   - Every fetch/XHR call is recorded. Non-2xx responses and failed requests (CORS, timeout, offline) count as errors.
   - Console errors, uncaught exceptions, and unhandled rejections are recorded.
   - A viewport screenshot is taken after errors and after every `POST`/`PUT`/`PATCH`/`DELETE` once the page settles. **Capture now** takes one manually.
3. Open the popup, optionally add **Catatan insiden**, and click **Generate Report**. The PDF downloads with events grouped per URL, screenshots, and AI suggestions. If PDF generation fails, use **Export JSON**.
4. Use **Clear** to start a fresh session. If you close a tab by accident, its session stays under **Sesi baru ditutup** for 30 minutes.

## Privacy and data handling

- Capture only runs on origins you explicitly enable. The extension holds no host access at install time.
- Sensitive values are redacted **before storage**: auth/cookie headers, fields like `password`, `pin`, `otp`, `token`, card numbers (Luhn), NIK, emails, and phone numbers. Redaction is best-effort, so review reports before sharing.
- Session data lives in the extension's IndexedDB. It is deleted on **Clear**, 30 minutes after its tab closes, and on every browser restart.
- Data is sent to the AI service only when you click **Generate Report**.

## Known limitations

- Screenshots cover the visible viewport only, and only when the tab is the visible tab of its window.
- Requests made before monitoring was enabled are not captured (reload the page).
- Cross-origin iframes, WebSockets, Server-Sent Events, and requests made by the page's own service worker are not captured.
- The popup must stay open while a report is being generated. If it closes, just generate again.

## Development

```powershell
npm test             # unit and component tests (Vitest)
npm run compile      # type-check
```

Project layout:

- `src/entrypoints/`: background service worker, popup (React), and the two runtime-registered content scripts (MAIN-world hooks and ISOLATED relay).
- `src/capture/`: fetch/XHR/console hooks and the page-to-extension bridge.
- `src/lib/`: redaction, classification, sessions (IndexedDB via Dexie), monitoring, the screenshot scheduler, AI client, and PDF report.
- Design system tokens: `docs/DESIGN.md`.
- Specs and design: `openspec/changes/add-brinspector-mvp/`.
