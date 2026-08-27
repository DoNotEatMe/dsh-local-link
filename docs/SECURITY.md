# Security model

## Intended deployment

- Harness remains on `127.0.0.1:3080`.
- Local Link listens on a private LAN interface through `0.0.0.0:3088`.
- The operating-system firewall limits the listener to private networks.
- The router does not forward the port to the internet.

## Protected assets

A connected Harness browser may read project data, submit prompts, approve actions, and trigger commands. A gateway credential therefore grants powerful access to the current Harness instance.

## Implemented controls

- Source-address classification for loopback, RFC1918 IPv4, link-local IPv4, IPv6 ULA, and IPv6 link-local ranges.
- IP-literal Host allowlist derived from current private interfaces.
- One-use, expiring pairing tokens.
- 256-bit device credentials.
- Hashed credentials at rest.
- `HttpOnly` and `SameSite=Strict` device cookie.
- Device expiry and explicit revocation.
- Authentication before HTTP proxying and WebSocket upgrade.
- Gateway-side block for desktop administration paths.
- No external relay or telemetry.

## Known limitations of the preview

### Plain HTTP

The initial release does not encrypt LAN traffic. Pairing credentials and Harness traffic can be observed by an attacker who can capture traffic on the local network. Use only on a trusted home network while HTTPS support is under development.

### Existing WebSockets

Revoking a device blocks subsequent requests and reconnects, but an already-upgraded WebSocket is not actively terminated yet. Restart Local Link to close every active connection immediately.

### Firewall automation

The plugin does not change Windows Firewall. This avoids surprising system-wide changes, but installation documentation must tell the operator to scope any manual rule to Private networks and the selected port.

### Compromised paired device

Pairing establishes device possession, not user identity. Anyone controlling a paired browser profile inherits its access until the device is revoked or expires.

## Non-goals

- Internet exposure.
- Multi-user accounts or workspace isolation.
- Authorization inside a Harness session.
- Protection against malware already executing as the desktop user.
- A replacement for TLS, VPN access control, or operating-system firewall policy.

Please report vulnerabilities privately rather than opening a public issue with exploit details.
