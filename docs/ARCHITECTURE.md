# Architecture

## Goals

`dsh-local-link` provides one narrow capability: open the existing DeepSeek Harness Web application from a browser on the same private network. The plugin should remain easy to audit, translate, install, and remove.

The architecture follows five constraints:

1. Keep the stock Harness listener loopback-only.
2. Put the network boundary in a dedicated Host-side gateway.
3. Use Cordis lifecycle and Harness slots instead of global DOM surgery.
4. Make automatic QR pairing and paired-device state explicit and revocable.
5. Keep presentation text outside implementation code.

## Components

### Host plugin

`src/plugin.ts` owns lifecycle integration. It starts the gateway, registers a loopback-only administration route on the existing Harness Web server, and closes both registrations with the Cordis effect.

### LAN gateway

`src/gateway/local-gateway.ts` owns the only non-loopback listener. It performs request-boundary validation, pairing, device-cookie authorization, and HTTP/WebSocket proxying.

The gateway changes upstream `Host`, `Origin`, and fetch-site headers to the loopback Harness origin. This is safe only after the gateway has authenticated the device. It lets Harness retain its own loopback request fence rather than configuring the primary server for every LAN address.

### Authentication state

`src/auth/pairing.ts` keeps short-lived, one-use pairing tokens in memory. They disappear on restart and are never persisted.

`src/auth/device-store.ts` persists device records atomically. A browser receives a 256-bit random credential; the file stores only its SHA-256 hash. Revocation deletes the corresponding record, which immediately invalidates future HTTP requests and WebSocket upgrades.

### Client plugin

`src/client.tsx` registers two normal Harness contributions: a compact desktop `sidebar.footer.action` that shows the local address and QR code, and a desktop-only `settings.section` that lists paired devices and revokes access. It does not replace the root layout, inspect localized ARIA labels, or mutate generated CSS-module class names.

On an authenticated gateway page, the client contributes the trust hint required by the Harness client connection. The proxied index makes the Settings package depend on this contribution so configuration surfaces do not initialize against the unauthenticated page classification.

Plain HTTP on a private IP is not a browser secure context, while the stock Harness RPC client calls `crypto.randomUUID()` during connection startup. The rewritten index therefore installs a small RFC 4122 v4 fallback backed by `crypto.getRandomValues()` before the stock boot manifest executes. This avoids certificate installation while keeping the LAN-only setup functional.

### Localization

JSON dictionaries under `src/locales/` are registered with Harness `LocaleRuntime`. The slot declares its locale namespace and receives the framework translation function. The application locale remains the single source of truth.

English and Chinese dictionaries intentionally contain the same key set. `tests/locales.test.ts` makes this a release invariant. Adding a language means adding one matching dictionary and registering that locale ID in `src/client.tsx`; component code remains unchanged.

## Stable UI contract

- Opening the sidebar panel issues a fresh one-time QR code; reopening is the refresh operation.
- Pairing is automatic and opens the desktop-selected session.
- The settings surface exists solely for device visibility and revocation.
- Address, access mode, and retention remain configuration, not end-user controls.

This boundary keeps connection setup in one place and persistent access management in one place without turning the plugin into a network-control dashboard.

## Request flows

### Pairing

1. The desktop sidebar action reads Harness's current session selection and requests a one-time token from the loopback administration route.
2. The Host builds a LAN URL containing the token and current session in the fragment, then renders it as a QR data URL. Neither value reaches the initial HTTP request.
3. The phone opens a minimal automatic connection page. The secret remains in the URL fragment and is not sent in the initial HTTP request.
4. The page immediately POSTs the token and a browser-derived device label; there is no confirmation form.
5. The gateway consumes the token, stores a credential hash, and sets the browser cookie.
6. Before booting Harness, the page writes the selected session into Harness's own `dsh.sessions.current` persisted-selection cell for the LAN browser origin.
7. The browser redirects to the complete stock Harness root. Harness loads the shared server-side session list and opens the transferred current conversation, whose ordinary WebSocket stream shows live agent activity.

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
- `qrcode`: QR rendering for the desktop settings page.

HTTP forwarding and the two Harness event WebSocket tunnels use Node's built-in `node:http` and `node:net` modules. No general-purpose proxy package is shipped.

No service discovery, certificate generator, tunnel client, native application, analytics SDK, or extension runtime is included.

## Compatibility strategy

The plugin targets the public package contracts in DeepSeek Harness `0.1.1-rc.2`. The only version-sensitive operation is the small boot-manifest dependency adjustment used by authenticated non-loopback pages. It fails closed when the expected Settings entry or plugin entry is absent.

Tests cover this transformation separately so a Harness upgrade produces a visible compatibility failure instead of a partially privileged mobile UI.
