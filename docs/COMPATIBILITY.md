# DeepSeek Harness compatibility

Local Link extends version-sensitive Harness Host, client-slot, theme, layout,
session, and Settings contracts. Compatibility is verified against exact Harness
versions and is never inferred from package installation alone.

## Compatibility matrix

Last checked on 2026-08-29 with Node.js 22 and Windows. Release candidates
were verified with `dsh-local-link@0.2.1`; the alpha was verified with the
current development checkout. Versions are listed newest first.

| DeepSeek Harness | Status | Last checked |
| --- | --- | --- |
| `0.1.2-alpha.1` | **Verified in development** | 2026-08-29 |
| `0.1.1-rc.2` | **Supported baseline** | 2026-08-29 |
| `0.1.1-rc.1` | **Verified** | 2026-08-29 |
| `0.1.0-rc.8` | **Verified** | 2026-08-29 |

Versions older than `0.1.0-rc.8` are untested and unsupported.

### Status meanings

- **Supported baseline** is the Harness version used for current development
  and the complete repository verification gate.
- **Verified** means the published plugin was installed and its core LAN,
  pairing, session, and responsive surfaces were checked on that version.
- **Verified in development** means the current checkout passed the same core
  checks, but the compatibility fix is not part of the published npm release yet.
- **Untested** means no compatibility claim is made.

`0.1.2-alpha.1` will become a supported prerelease target with the next Local
Link release. Every newer Harness alpha still requires an independent check.

## Verification policy

Every new Harness prerelease or release is checked in a fresh isolated
installation. A version is promoted only after the plugin boots, the LAN and
pairing boundary works, the current session opens, and the responsive
navigation, conversation, Current session, and subagent surfaces have been
exercised. Real-phone portrait and landscape checks are required for a new
supported baseline.

A successful package installation alone is not compatibility proof. Harness
may change authentication, DOM semantics, client slots, exported primitives,
theme storage, or responsive geometry while the plugin still appears to boot.
