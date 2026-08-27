# dsh-local-link

Lightweight mobile-browser access to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) over a local network.

`dsh-local-link` keeps the normal Harness server on loopback and exposes a small, separate LAN gateway. Pair a phone once with a QR code, then use the stock Harness UI from that browser. There is no cloud relay, tunnel provider, native app, extension marketplace, or replacement sidebar.

> Status: early development preview. The current gateway uses HTTP and is intended only for a trusted private network. HTTPS support is the next security milestone.

## Why this plugin exists

Existing mobile-access plugins tend to become complete remote-access platforms: they add hosted relays, third-party tunnels, native apps, custom mobile shells, or large DOM patches. That can be useful, but it is more machinery than a local phone-to-PC workflow needs and makes localization and UI compatibility harder.

This project deliberately optimizes for:

- **Local first:** the phone and computer are on the same private network.
- **Lightweight:** three small runtime dependencies and no external service.
- **Stock Harness UI:** no replacement layout and no sidebar-footer button.
- **Native integration:** the control page is a normal Harness Settings section.
- **Low-friction pairing:** scan one QR code; no account or password form.
- **Maintainable localization:** all user-facing plugin copy is in JSON dictionaries.

## Current feature set

- HTTP and WebSocket reverse proxy to `127.0.0.1:3080`.
- Private-network and strict local-IP Host checks.
- One-time QR pairing token with a five-minute default lifetime.
- Per-device random credential stored in an `HttpOnly`, `SameSite=Strict` cookie.
- Only SHA-256 credential hashes are stored on disk.
- Paired-device list and revocation from `Settings → Local Link`.
- `pairing` and explicit `trusted-lan` modes.
- English and Chinese dictionaries registered through Harness `LocaleRuntime`.
- Responsive settings page without querying or replacing Harness DOM.

## Install from a checkout

Requirements: Node.js 22.19+ (or 24+), DeepSeek Harness `0.1.1-rc.2`, and a working Harness Web profile.

```powershell
npm install
npm run verify
dsh plugin --profile web add "D:\Projects\dsh-local-link"
dsh web --profile web
```

Open Harness on the computer, then select `Settings → Local Link`. Create a pairing QR and scan it with the phone connected to the same Wi-Fi.

If `dsh` is not globally available, use the executable from the local Harness installation:

```powershell
D:\AI\deepseek-harness\node_modules\.bin\dsh.CMD plugin --profile web add "D:\Projects\dsh-local-link"
D:\AI\deepseek-harness\node_modules\.bin\dsh.CMD web --profile web
```

## Configuration

The included `cordis.patch.yml` installs these defaults:

```yaml
listenHost: 0.0.0.0
listenPort: 3088
upstreamOrigin: http://127.0.0.1:3080
accessMode: pairing
pairingTtlSeconds: 300
deviceTtlDays: 90
```

`trusted-lan` disables the device check. It is convenient for an isolated development VLAN, but `pairing` is the recommended default because a Harness session can execute commands and modify files.

## Localization

The plugin uses the same `LocaleRuntime` registry as Harness. Dictionaries are plain JSON:

```text
src/locales/en.json
src/locales/zh.json
```

Both files must contain the same keys; the test suite enforces parity. Adding or editing text does not require touching the UI component. Harness `0.1.1-rc.2` currently exposes `en` and `zh` as selectable application locales, so those are the shipped dictionaries. When Harness adds another locale ID, add the matching JSON file and register it in `src/client.tsx`.

## Security boundary

The LAN listener is not a second Harness instance. It is an authenticated gateway to the loopback-only instance:

```text
Phone browser
  → local IP :3088
  → private-network + Host validation
  → device cookie validation
  → HTTP/WebSocket proxy
  → 127.0.0.1:3080 (DeepSeek Harness)
```

The gateway blocks its desktop administration API before proxying. Desktop administration remains available only from the loopback Harness origin.

Current limitation: HTTP does not protect traffic from passive observers on the local network. Do not expose port 3088 to the internet or use it on public Wi-Fi. See [Security model](docs/SECURITY.md).

## Development

```powershell
npm run typecheck
npm test
npm run build
npm run verify
```

Architecture and extension boundaries are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The short roadmap is in [docs/ROADMAP.md](docs/ROADMAP.md).

A ready GitHub Actions workflow is kept at `docs/ci.github-actions.example.yml`. Copy it to `.github/workflows/ci.yml` when the publishing credential has the GitHub `workflow` scope.

## License

MIT
