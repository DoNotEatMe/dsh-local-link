# Changelog

All notable changes to this project are documented here.

## 0.2.1 — 2026-08-29

### Fixed

- Quoted the `trustedHosts` JavaScript expression in the bundled Cordis overlay so a clean npm installation parses and boots with the strict DSH patch-list YAML schema.

### Validated

- Recorded isolated published-package compatibility with DeepSeek Harness `0.1.0-rc.8`, `0.1.1-rc.1`, and the supported `0.1.1-rc.2` baseline using one populated English fixture across navigation, chat, Current session, and subagents.
- Added inspectable screenshot evidence for all four Mobile View surfaces and documented that ordinary root URLs activate the responsive shell without a URL flag.
- Built the official upstream `0.1.2-alpha.1` tag and installed the published plugin into an isolated profile; recorded it as known incompatible because the new authority-bound browser authentication cannot cross the Local Link gateway and the changed header omits Current session.

## 0.2.0 — 2026-08-29

### Added

- Phone and tablet Mobile View with drawer navigation, safe-area support, and automatic viewport activation through the native Harness client.
- Current session drawer with context usage and breakdown, model, workspace access, agent preset, session activity, and native session-log download.
- Touch-friendly subagent status chip and bottom sheet built from Harness session catalogs and actions.
- Visible total/active subagent counts mirrored in the compact control's accessible name.
- Mobile appearance control driven by the Harness theme service.
- Shared mobile-dialog focus lifecycle with initial focus, keyboard containment, Escape handling, and focus restoration.
- English and Chinese copy for the pre-Harness automatic pairing page, selected from the browser language.
- A dedicated Mobile View guide and release acceptance matrix.

### Changed

- Reworked the stock Web client's cramped desktop-oriented narrow-screen presentation into touch-friendly navigation, session details, subagent controls, and conversation geometry without introducing a replacement client.
- Mobile View now enhances the shipped Harness AppFrame without replacing the root layout, preserving dynamic conversation views, overlays, composer extensions, and third-party registrations.
- The subagent duration clock now runs only while a visible catalog contains active work; it observes no network or session data itself.
- Authenticated gateway authorities now enter the official connection `trustedHosts` contract while privileged settings, credential, Host, and preset-authoring RPCs remain loopback-only.
- The gateway preserves the browser's original Host and origin headers instead of impersonating the loopback origin.
- Remote gateway boot omits the host directory-picker capability, so `Add workspace` is not offered while existing workspaces and sessions remain available.
- Plugin-owned controls use Harness button/input primitives, semantic tokens, and one shared Local Link hairline border variable.
- Left navigation, details, and Current session surfaces use the same compact drawer width.

### Fixed

- Prevented the mobile keyboard from opening automatically after switching sessions.
- Restored immediate access to native session and active-workspace overflow actions on touch devices.
- Separated the DeepSeek Harness brand and appearance-control hit areas.
- Kept Cordis panels viewport-bound and readable in the responsive mobile presentation.
- Removed QR-panel overflow artifacts and normalized Local access, diagnostics, device, and mobile border weight.
- Matched the documented Mobile View activation boundary at `834` CSS pixels.
- Rejected public listener addresses, loopback-lookalike Host/Origin values, and malformed device cookies without widening access or destabilizing the gateway.
- Allowed device-state persistence to recover after a transient filesystem failure instead of poisoning every later write until restart.
- Kept background diagnostics fail-soft while making an explicit `Clear` report persistence errors honestly and recover on the next attempt.

### Compatibility notes

- Mobile View targets DeepSeek Harness `0.1.1-rc.2`; responsive layout and several stock-DOM presentation hooks remain version-sensitive.
- A remote browser inherits the selected Harness session permissions. Hiding `Add workspace` is a mobile UX constraint, not an authorization boundary.
- In the supported Harness release, a remote light/dark choice is memory-backed and resets on reload to the host preference resolved against the remote device's system theme.

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
