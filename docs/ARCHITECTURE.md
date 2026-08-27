# Architecture

## Goals

`dsh-local-link` provides one narrow capability: open the existing DeepSeek Harness Web application from a browser on the same private network. The plugin should remain easy to audit, translate, install, and remove.

The architecture follows five constraints:

1. Keep the stock Harness listener loopback-only.
2. Put the network boundary in a dedicated Host-side gateway.
3. Use Cordis lifecycle and Harness slots instead of global DOM surgery.
4. Make paired-device state explicit and revocable.
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

`src/client.tsx` registers a normal `settings.section` entry. It does not occupy `sidebar.footer.action`, replace the root layout, inspect localized ARIA labels, or mutate generated CSS-module class names.

On an authenticated gateway page, the client contributes the trust hint required by the Harness client connection. The proxied index makes the Settings package depend on this contribution so configuration surfaces do not initialize against the unauthenticated page classification.

### Localization

JSON dictionaries under `src/locales/` are registered with Harness `LocaleRuntime`. The slot declares its locale namespace and receives the framework translation function. The application locale remains the single source of truth.

## Request flows

### Pairing

1. Desktop Settings requests a one-time token from the loopback administration route.
2. The Host builds a LAN URL and renders it as a QR data URL.
3. The phone opens a static pairing page. The secret remains in the URL fragment and is not sent in the initial HTTP request.
4. The page POSTs the token and an optional device label.
5. The gateway consumes the token, stores a credential hash, and sets the browser cookie.
6. The browser redirects to the stock Harness root.

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
- `http-proxy`: mature HTTP and WebSocket proxy transport.
- `qrcode`: QR rendering for the desktop settings page.

No service discovery, certificate generator, tunnel client, native application, analytics SDK, or extension runtime is included.

## Compatibility strategy

The plugin targets the public package contracts in DeepSeek Harness `0.1.1-rc.2`. The only version-sensitive operation is the small boot-manifest dependency adjustment used by authenticated non-loopback pages. It fails closed when the expected Settings entry or plugin entry is absent.

Tests cover this transformation separately so a Harness upgrade produces a visible compatibility failure instead of a partially privileged mobile UI.
