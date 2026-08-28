# Changelog

All notable changes to this project are documented here.

## 0.1.0 — 2026-08-28

### Added

- Local-only authenticated gateway to the stock DeepSeek Harness Web UI.
- One-use QR and copyable-link pairing with expiry and regeneration.
- Current-session transfer and live HTTP/WebSocket proxying.
- Remembered browsers with editable names, detected category/browser metadata, and revocation.
- Native sidebar and Settings integration with English and Chinese localization.
- Compatibility handling for Cordis footer coexistence and legacy device records.
- Mobile pairing page with robust browser detection, bounded connection time, and visible network/expiry errors instead of an endless spinner.
- Event-driven local diagnostics retaining only the latest 15 failures, with structured codes, burst coalescing, privacy allowlisting, Settings inspection, report copying, and clearing.
- Automated type checking, tests, package verification, CI, and npm release preparation.

### Known limitations

- Plain HTTP on the LAN.
- Existing WebSockets are not actively closed on revoke.
- Compatibility is currently pinned to DeepSeek Harness `0.1.1-rc.2`.
