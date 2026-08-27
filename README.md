# dsh-local-link

Lightweight mobile-browser access to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) over a local network.

`dsh-local-link` keeps the normal Harness server on loopback and exposes a small, separate LAN gateway. Click the phone button in the Harness sidebar, scan its QR code, and the browser opens the complete stock Harness UI at the session currently selected on the computer. There is no cloud relay, tunnel provider, native app, extension marketplace, or replacement sidebar.

> Status: early development preview. The current gateway uses HTTP and is intended only for a trusted private network. HTTPS support is the next security milestone.

## Why this plugin exists

Existing mobile-access plugins tend to become complete remote-access platforms: they add hosted relays, third-party tunnels, native apps, custom mobile shells, or large DOM patches. That can be useful, but it is more machinery than a local phone-to-PC workflow needs and makes localization and UI compatibility harder.

This project deliberately optimizes for:

- **Local first:** the phone and computer are on the same private network.
- **Lightweight:** two small runtime dependencies and no external service.
- **Stock Harness UI:** one native sidebar action; no replacement layout or mobile shell.
- **Native integration:** the control page is a normal Harness Settings section.
- **Low-friction connection:** scan one QR code; no confirmation, account, or password form.
- **Maintainable localization:** all user-facing plugin copy is in JSON dictionaries.

## Current feature set

- HTTP and WebSocket reverse proxy to `127.0.0.1:3080`.
- Browser-compatible UUID fallback for stock Harness RPC on plain private-LAN HTTP.
- Private-network and strict local-IP Host checks.
- Sidebar phone action with the local address and a one-time QR code.
- Automatic one-time pairing with a five-minute default token lifetime.
- Transfer of the desktop's currently selected session into the newly paired browser.
- Per-device random credential stored in an `HttpOnly`, `SameSite=Strict` cookie.
- Only SHA-256 credential hashes are stored on disk.
- Paired-device list and revocation from `Settings → Local access`.
- `pairing` and explicit `trusted-lan` modes.
- English and Chinese dictionaries registered through Harness `LocaleRuntime`.
- Responsive settings page without querying or replacing Harness DOM.

## Install from a checkout

Requirements: Node.js 22.19+ (or 24+), DeepSeek Harness `0.1.1-rc.2`, and a working Harness Web profile.

```powershell
npm install
npm run verify
dsh plugin --profile web add (Get-Location).Path
dsh web --profile web
```

Open the desired session in Harness on the computer, click `Local access` at the bottom of the sidebar, and scan the QR code with a phone on the same Wi-Fi. The phone is registered automatically and redirected directly to that session in the full Harness interface. The session list and live conversation still come from the same Harness Host; the plugin only transfers the current selection between the two browser origins. `Settings → Local access` exists only to list paired devices and revoke access.

## Product boundary

The stable UI contract is intentionally small:

- `Local access` in the desktop sidebar creates one fresh, five-minute QR code and shows the LAN address.
- Closing and reopening the panel creates another QR code; a separate refresh control is unnecessary.
- The Settings section contains only paired devices and `Revoke`, because access removal is the one persistent operation users need.
- Gateway configuration stays in `cordis.patch.yml`; the UI does not duplicate developer-oriented address, mode, or retention controls.

The plugin does not replace Harness navigation, session storage, conversation rendering, or theme handling.

If `dsh` is not globally available, use the executable from the local Harness installation:

```powershell
$harnessRoot = "C:\path\to\deepseek-harness"
& "$harnessRoot\node_modules\.bin\dsh.CMD" plugin --profile web add (Get-Location).Path
& "$harnessRoot\node_modules\.bin\dsh.CMD" web --profile web
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

`trusted-lan` disables the device check. It is convenient for an isolated development VLAN, but automatic QR `pairing` is the recommended default because a Harness session can execute commands and modify files.

## Localization

The plugin uses the same `LocaleRuntime` registry as Harness. Dictionaries are plain JSON:

```text
src/locales/en.json
src/locales/zh.json
```

Localization is JSON dictionaries registered through Harness `LocaleRuntime`: `en.json` and `zh.json` contain identical keys, and the active Harness language selects the dictionary. The parity test prevents one language from silently missing UI text. To add a Harness-supported locale, copy the keys into another JSON file and register it in `src/client.tsx`.

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
