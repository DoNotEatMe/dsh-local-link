# Roadmap

## 0.1 — local prototype

- [x] Separate LAN gateway.
- [x] HTTP and WebSocket proxy.
- [x] One-time QR pairing.
- [x] Persistent per-device credentials and revocation.
- [x] Native Settings section.
- [x] JSON-backed English and Chinese localization.
- [x] Core unit and integration tests.

## 0.2 — secure local release

- [ ] Locally generated CA and server-certificate lifecycle.
- [ ] Clear certificate onboarding for Android and iOS browsers.
- [ ] Active WebSocket termination on device revocation.
- [ ] Windows Firewall guidance and optional explicit setup command.
- [ ] Mobile viewport acceptance matrix against current Harness.
- [ ] Compatibility test against the newest supported Harness release.

## Later, only if justified

- [ ] Multiple selectable LAN interfaces.
- [ ] mDNS discovery as an optional dependency.
- [ ] Additional Harness-supported locale dictionaries.
- [ ] PWA metadata.

Remote relays, public tunnels, native mobile applications, arbitrary client scripts, and plugin-specific UI themes are intentionally outside the project scope.
