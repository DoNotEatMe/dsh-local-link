# DeepSeek Harness compatibility

Local Link extends version-sensitive Harness Host, client-slot, theme, layout,
session, and Settings contracts. Compatibility is recorded from isolated
installations and live browser checks, not inferred from package versions.

The format follows the DSH community convention: name the exact Harness
version, the last verification date, a status, and inspectable evidence.

## Compatibility matrix

Verified on 2026-08-29 with the published `dsh-local-link@0.2.1` package,
Node.js 22, and Windows:

| DeepSeek Harness | Status | Evidence |
| --- | --- | --- |
| `0.1.1-rc.2` | **Supported baseline** | Complete Local Link typecheck and 92-test suite; clean package/profile install; Host `200`; unauthenticated gateway `401`; client boot entry; populated Mobile View fixture across navigation, chat, Current session, and subagents |
| `0.1.1-rc.1` | **Verified previous release** | Clean package/profile install; Host and gateway boundary checks; client boot entry; the same populated four-surface Mobile View fixture |
| `0.1.0-rc.8` | **Verified previous release** | Clean package/profile install; Host and gateway boundary checks; client boot entry; the same populated four-surface Mobile View fixture |
| `0.1.2-alpha.1` | **Not verified** | Source-only upstream prerelease at the verification date; it changes client/proxy/authentication contracts and requires a dedicated compatibility port before support can be claimed |

Versions older than `0.1.0-rc.8` are untested and unsupported.

### Status meanings

- **Supported baseline** receives the complete repository verification gate and
  the populated browser compatibility fixture.
- **Verified previous release** proves published-package installation, boot and
  the same populated browser fixture. It remains a compatibility target, but
  new development is based on the supported baseline.
- **Not verified** is explicit: package installation or runtime behavior has
  not been proven, so no compatibility claim is made.

## Browser evidence

Every capture below comes from the same real Harness session and the same safe
English fixture at `430 × 932`. Each version was opened at its plain root URL.
There is no Mobile View URL flag, alternate bundle, user-agent branch, or URL
rewrite: `matchMedia('(max-width: 834px)')` selects the responsive presentation.

| Harness | Left navigation | Chat |
| --- | --- | --- |
| `0.1.1-rc.2` | <img src="images/compat-0.1.1-rc.2-navigation.jpg" width="210" alt="Local Link Mobile View navigation on Harness 0.1.1-rc.2"> | <img src="images/compat-0.1.1-rc.2-chat.jpg" width="210" alt="Local Link Mobile View chat on Harness 0.1.1-rc.2"> |
| `0.1.1-rc.1` | <img src="images/compat-0.1.1-rc.1-navigation.jpg" width="210" alt="Local Link Mobile View navigation on Harness 0.1.1-rc.1"> | <img src="images/compat-0.1.1-rc.1-chat.jpg" width="210" alt="Local Link Mobile View chat on Harness 0.1.1-rc.1"> |
| `0.1.0-rc.8` | <img src="images/compat-0.1.0-rc.8-navigation.jpg" width="210" alt="Local Link Mobile View navigation on Harness 0.1.0-rc.8"> | <img src="images/compat-0.1.0-rc.8-chat.jpg" width="210" alt="Local Link Mobile View chat on Harness 0.1.0-rc.8"> |

| Harness | Current session | Subagents |
| --- | --- | --- |
| `0.1.1-rc.2` | <img src="images/compat-0.1.1-rc.2-session-info.jpg" width="210" alt="Local Link Current session drawer on Harness 0.1.1-rc.2"> | <img src="images/compat-0.1.1-rc.2-subagents.jpg" width="210" alt="Local Link subagents sheet on Harness 0.1.1-rc.2"> |
| `0.1.1-rc.1` | <img src="images/compat-0.1.1-rc.1-session-info.jpg" width="210" alt="Local Link Current session drawer on Harness 0.1.1-rc.1"> | <img src="images/compat-0.1.1-rc.1-subagents.jpg" width="210" alt="Local Link subagents sheet on Harness 0.1.1-rc.1"> |
| `0.1.0-rc.8` | <img src="images/compat-0.1.0-rc.8-session-info.jpg" width="210" alt="Local Link Current session drawer on Harness 0.1.0-rc.8"> | <img src="images/compat-0.1.0-rc.8-subagents.jpg" width="210" alt="Local Link subagents sheet on Harness 0.1.0-rc.8"> |

The screenshots prove the four named responsive surfaces with a populated
session. They do not replace the real-phone portrait/landscape checklist or
prove arbitrary third-party fixed-width views.

## What was exercised

For each verified Harness version:

1. Install the published plugin into an isolated profile and `DSH_HOME`.
2. Compose the Local Link patch and confirm its client entry in the boot
   manifest.
3. Verify the Host responds, the unauthenticated gateway rejects access, and
   both processes stop after the test.
4. Open the ordinary root URL at `430 × 932` with no query parameter or special
   user agent.
5. Load the same workspace, populated conversation, permissions, model,
   context breakdown, and three settled subagents.
6. Exercise the left navigation, chat, Current session drawer, and subagent
   bottom sheet and capture each surface.

The primary baseline additionally runs type checking, all automated tests, and
the package dry-run.

## Upgrade procedure

For every new Harness prerelease or release:

1. Record the exact version and verification date; never infer compatibility
   from an npm dist-tag.
2. Use a fresh package installation and separate `DSH_HOME`.
3. Inspect upstream Host, client-slot, connection, authentication, theme,
   layout, session, and Settings contract changes before booting the plugin.
4. Repeat the HTTP boundary checks and the populated four-surface browser
   fixture on a plain root URL.
5. Run repository verification against the new dependency baseline.
6. Complete the real-phone portrait and landscape checklist before promoting
   the version to the supported baseline.

A successful install or a single empty-shell screenshot is insufficient.
Harness releases can alter DOM semantics, slot payloads, exported primitives,
theme storage, or responsive geometry while the package still boots.
