# Architecture

## Goals

`dsh-local-link` provides one narrow capability: open the existing DeepSeek Harness Web application from a browser on the same private network. The plugin should remain easy to audit, translate, install, and remove.

The architecture follows six constraints:

1. Keep the stock Harness listener loopback-only.
2. Put the network boundary in a dedicated Host-side gateway.
3. Use Cordis lifecycle and Harness slots for all rendered UI; isolate the one settings-navigation compatibility bridge required by Harness `0.1.1-rc.2`.
4. Make automatic QR pairing and paired-device state explicit and revocable.
5. Keep presentation text outside implementation code.
6. Keep support diagnostics local, bounded, structured, and free of credentials or user content.

## Components

### Host plugin

`src/plugin.ts` owns lifecycle integration. It starts the gateway, registers a loopback-only administration route on the existing Harness Web server, and closes both registrations with the Cordis effect.

### LAN gateway

`src/gateway/local-gateway.ts` owns the only non-loopback listener. It performs request-boundary validation, pairing, device-cookie authorization, and HTTP/WebSocket proxying.

The gateway changes upstream `Host`, `Origin`, and fetch-site headers to the loopback Harness origin. This is safe only after the gateway has authenticated the device. It lets Harness retain its own loopback request fence rather than configuring the primary server for every LAN address.

### Authentication state

`src/auth/pairing.ts` keeps short-lived, one-use pairing tokens in memory. They disappear on restart and are never persisted.

`src/auth/device-store.ts` persists device records atomically. A browser receives a 256-bit random credential; the file stores only its SHA-256 hash. Revocation deletes the corresponding record, which immediately invalidates future HTTP requests and WebSocket upgrades.

### Diagnostics

`src/diagnostics.ts` persists a versioned ring of structured failure events. The default cap is 15 entries. Successful starts, requests, pairing, renames, revocations, and button clicks do not enter the ring. Context fields pass through a fixed allowlist; arbitrary objects and sensitive identifiers cannot enter the report even if a future call site tries to add them. Writes are atomic and deliberately fail soft so a diagnostics filesystem problem cannot take down local access.

The loopback administration route exposes list, clear, and a narrow allowlisted client-error endpoint only to the desktop UI. The endpoint accepts stable codes for clipboard, rename, and revoke failures; it cannot accept arbitrary messages or context. Nothing is uploaded, and the LAN gateway blocks the administration prefix. The Settings report includes timestamps, severity, stable event codes, and short operational categories—not tokens, cookies, IP addresses, device or session IDs, names, URLs, request paths, prompts, conversations, or project data.

### Client plugin

`src/client.tsx` registers two normal Harness contributions: a compact desktop `sidebar.footer.action` that shows a QR code and copyable one-time link, and a desktop-only `settings.section` that manages paired devices and the local diagnostic report. It does not replace the root layout or mutate generated CSS-module class names.

The Harness `sidebar.footer.action` contract is a list, but `0.1.1-rc.2` renders that list as a horizontal flex row while the stock Cordis action reserves `width: 100%` with `flex: none`. Without a compatibility rule, Cordis reduces later actions to zero width. Local Link orders its entry first and changes only the footer container that semantically contains `.dsh-local-link-footer` into a vertical stack. The same scoped rule normalizes the list gap and removes the following action's private top margin so Local access, Cordis, and Settings keep one visual rhythm. The selector is anchored on the plugin-owned class and accounts for the slot renderer's `display: contents` wrapper; it never names a generated Harness class.

The connection card is fixed to the viewport and positioned from the rendered Local access action. On desktop it opens just beyond the sidebar edge and remains vertically centered. Its final QR-state height is reserved before the pairing request resolves, so loading the QR cannot move the card after its first visible frame. On narrow or short viewports it is clamped to a 12 px viewport gutter and scrolls internally instead of moving footer actions or covering them.

Harness `0.1.1-rc.2` keeps settings open state and section selection private inside its shell; the public `openSection` callback is only projected to onboarding steps. The popover's `Paired devices` shortcut therefore uses one bounded compatibility bridge: it clicks the semantic settings dialog trigger and then the nav row matching this plugin's own localized section label. The bridge uses no generated class names, mutates no DOM, and can be removed when Harness exposes a general settings-navigation service.

On an authenticated gateway page, the client contributes the trust hint required by the Harness client connection. The proxied index makes the Settings package depend on this contribution so configuration surfaces do not initialize against the unauthenticated page classification.

Plain HTTP on a private IP is not a browser secure context, while the stock Harness RPC client calls `crypto.randomUUID()` during connection startup. The rewritten index therefore installs a small RFC 4122 v4 fallback backed by `crypto.getRandomValues()` before the stock boot manifest executes. This avoids certificate installation while keeping the LAN-only setup functional.

### Localization

JSON dictionaries under `src/locales/` are registered with Harness `LocaleRuntime`. The slot declares its locale namespace and receives the framework translation function. The application locale remains the single source of truth.

English and Chinese dictionaries intentionally contain the same key set. `tests/locales.test.ts` makes this a release invariant. Adding a language means adding one matching dictionary and registering that locale ID in `src/client.tsx`; component code remains unchanged.

## Stable UI contract

- Opening the sidebar panel issues one invitation represented by the same QR code and copyable link.
- The client shows the server-issued expiry countdown; generating another code invalidates the previous invitation before replacing it.
- While the panel is open, its loopback-only status check closes the invitation UI as soon as the Host reports that the token was consumed.
- Pairing is automatic and opens the desktop-selected session.
- The settings surface owns device visibility, display-name editing, revocation, and the bounded local diagnostic report.
- Listener address, access mode, and retention remain configuration, not separate end-user controls; the reachable address is already part of the one-time link.

This boundary keeps connection setup in one place and persistent access management in one place without turning the plugin into a network-control dashboard.

### Diagnostic event flow

1. A failed user action, rejected request, or broken proxy boundary emits a stable `warn` or `error` code. Successful operations emit nothing.
2. `DiagnosticStore` discards every context key outside `reason`, `method`, and `requestKind`, coalesces identical five-second bursts, retains at most 15 events by default, and persists atomically.
3. The desktop-only administration route returns newest-first events. Opening Local access reads it once; only the explicit `Refresh` action reads it again.
4. Settings renders the newest 12 events and can copy all retained events as an issue report or clear the store. No diagnostics timer, background upload, analytics SDK, or remote endpoint exists.

## Request flows

### Pairing

1. The desktop sidebar action reads Harness's current session selection and requests a one-time token from the loopback administration route. Issuing it clears any older unconsumed invitation.
2. The Host builds a LAN URL containing the token and current session in the fragment, then renders the same URL as a QR data URL. Neither value reaches the initial HTTP request.
3. The phone opens a minimal automatic connection page. The secret remains in the URL fragment and is not sent in the initial HTTP request.
4. The page immediately POSTs the token with a coarse device category and browser name; there is no confirmation form and no fingerprinting.
5. The gateway consumes the token, stores a credential hash, and sets the browser cookie.
6. The desktop's loopback-only status check observes the consumed token and closes the QR panel.
7. Before booting Harness, the page writes the selected session into Harness's own `dsh.sessions.current` persisted-selection cell for the LAN browser origin.
8. The browser redirects to the complete stock Harness root. Harness loads the shared server-side session list and opens the transferred current conversation, whose ordinary WebSocket stream shows live agent activity.

### Normal request

1. Reject requests not originating from a private or loopback address.
2. Reject a `Host` that is not one of the machine's current private IP literals and configured port.
3. Reject the gateway administration prefix.
4. Validate the paired-device cookie unless `trusted-lan` was explicitly configured.
5. Proxy to the loopback Harness listener.

### WebSocket upgrade

The same network, Host, and credential checks run before the upgrade is passed to the upstream server. Revocation affects new connections; a future milestone will actively close already-open sockets for a revoked device.

## Dependency policy

Runtime dependencies are intentionally limited:

- `@deepseek-ai/schemastery`: Cordis-compatible configuration schema.
- `qrcode`: QR rendering for the desktop sidebar panel.

HTTP forwarding and the two Harness event WebSocket tunnels use Node's built-in `node:http` and `node:net` modules. No general-purpose proxy package is shipped.

No service discovery, certificate generator, tunnel client, native application, analytics SDK, remote log collector, or extension runtime is included.

## Compatibility strategy

The plugin targets DeepSeek Harness `0.1.1-rc.2`. Most integration uses declared package contracts, but three adapters are intentionally version-sensitive:

| Adapter | Why it exists | Failure behavior | Removal condition |
| --- | --- | --- | --- |
| Boot-manifest dependency adjustment | Authenticated non-loopback pages must load the Local Link trust hint before Settings initializes. | Fails closed when the expected plugin or Settings entry is absent. | Harness exposes a supported authenticated-gateway boot contract. |
| Settings navigation bridge | The shell keeps `openSection` private outside onboarding. | The shortcut does nothing; ordinary `Settings → Local access` remains available. | Harness exposes general settings navigation. |
| Footer stack rule | Cordis reserves a full-width cell inside a horizontal list container. | Without it, Local access has zero width while Cordis is mounted. | Harness stacks full-width footer actions or gives entries an explicit layout contract. |

The manifest transformation has direct tests. The two presentation adapters are verified during browser acceptance against the supported Harness build; release screenshots are also taken from that real composition with Cordis mounted.

## Known pressure points

- **Plain HTTP:** avoids certificate onboarding but offers no confidentiality from other machines able to capture LAN traffic.
- **Socket revocation:** the credential is checked before an upgrade; an already-upgraded socket survives until it disconnects or Harness restarts.
- **Browser metadata:** category and browser are coarse display hints supplied during pairing, not trusted identity. Laptop versus desktop is intentionally reported as `Computer`.
- **Interface selection:** the first private IPv4 address is used in invitations. Multi-interface selection is not exposed yet.
- **Harness upgrades:** boot graph names, shell semantics, or client connection assumptions may change even when TypeScript package contracts still compile.
- **Process lifecycle:** Host-side updates require a Harness restart. Client artifacts may be read from disk on reload, which can temporarily create a mixed-version UI; compatibility normalization prevents old device records from rendering blank.

These are documented constraints, not hidden fallback modes. Release readiness requires the automated gate plus a real browser check of pairing, live conversation streaming, Cordis coexistence, settings navigation, rename, and revoke.
