# Repository guidance

- Keep the plugin local-network-only. Remote relays and tunnels are out of scope.
- Prefer DeepSeek Harness slots and locale services over DOM patching.
- User-visible copy must live in `src/locales/*.json`.
- Keep the default dependency surface small and explain every runtime dependency.
- Security-sensitive behavior requires tests: pairing expiry, device revocation,
  Host validation, private-network filtering, and authenticated WebSocket access.
- Never commit certificates, device state, access tokens, or machine-specific paths.
