# Release 1.1.1 verification — 2026-11-13

The floating website panel now matches the study interface, has complete Arabic labels and explicit language direction, and keeps chess notation/scores left-to-right. English/Arabic preferences synchronize with settings without changing the AI explanation language. The donation button, its images and their web-accessible manifest entries are removed. Original attribution, license, engine assets and other panel controls remain.

Starting checkout: **`541cccf6805adb1b336930e38dbb3048e83f5f6b`**, clean before this patch. Original upstream baseline remains **`01b990b9424ac0eef905376b40d14faf8dd076c0`**.

| Command/check | Final result |
| --- | --- |
| `scripts/setup.ps1` | Exit **0**; ran tests, build and checks |
| `npm test` | **89 passed**: 19 original + 70 added; **0 failed, 0 skipped**; added-suite duration **2172.4026 ms** |
| `npm run build` | Exit **0**; all five extension bundles generated |
| `npm run check` | Exit **0**; **40 JavaScript syntax checks**, manifest and all five extension token-boundary checks passed |
| `npm run test:browser` | Exit **0**; **15 checks passed**, no page errors |
| `npm run test:ui` | Exit **0**; **21 checks passed** in **14470 ms**, no page errors/external HTTP traffic; three synthetic inference requests |
| `npm run test:panel` | Exit **0**; **19 checks passed** in **25145 ms**, no page errors, companion requests or external requests |
| `git diff --check` | Exit **0**, no whitespace errors |
| Original Stockfish assets | Unchanged under `extension/engine` |

Windows, Node **26.4.0**, npm **12.0.2**, Chrome for Testing **145.0.7632.6**, Playwright **1.58.2**. Dependency versions were unchanged by this patch. All browser profiles and test extension copies were isolated; no personal Chrome profile or running companion was used.

The new panel suite places the real extension on **synthetic** Chess.com HTML with `dir=rtl`, right alignment and dark styling. It verifies that English stays LTR, Arabic switches to RTL, the host remains unchanged, and SAN, scores, variations and candidate notation remain LTR. It exercises labelled native controls with the keyboard, the settings shortcut, help/collapse/power states, model-independent language synchronization, retained Polish/Spanish/German choices, reset behavior, three local candidates, one stable selected arrow, board orientation, resize and 320/390-pixel layouts. Sampled text contrast ranges from **5.60:1 to 14.67:1**. Screen-reader software and a complete accessibility audit were not run.

Two browser assertions needed event-settling corrections: the existing study test checked before ResizeObserver repositioned its SVG (measured alignment settled to zero difference in **11 ms**), and a new range-input test checked before the second keyboard update settled. Tests now use bounded waits and retain exact values/focus checks; the study overlay must align within **1 pixel** on all four dimensions. The new suite also accepts the browser's valid computed `color-scheme: light only` serialization. Final results above are the successful reruns.

The first Windows CI run exposed **9 pixels of horizontal overflow at 320px**, despite the local panel suite passing. The two training action buttons now stack at full width below a 350px panel width. This prevents the AI settings label from being squeezed beside the primary action, including when a vertical scrollbar reduces available space. The regression retains strict overflow limits and checks the stacked button widths, including a test-only 10px reserved scrollbar gutter. Both buttons retain the full 238px available width in that case, with zero body/training overflow in English and Arabic; no clipping workaround was added.

No live OAuth, model catalog, inference or Chess.com requests were made for this patch. The existing study/settings tests use mocked provider services; the panel test makes **zero** companion requests. Live site compatibility remains unverified, and page detection still cannot reliably identify bots. Earlier authorized provider checks below do not establish current live-site compatibility.

Evidence: [panel results](docs/verification/panel-browser-results.json), [study/settings results](docs/verification/ui-browser-results.json), [extension results](docs/verification/browser-results.json), [English panel](docs/images/panel-en.png), [Arabic panel](docs/images/panel-ar.png). Screenshots contain only synthetic data.

The requested skills guided this patch. Existing ui-sdk components remain bundled on extension pages; the floating panel uses named native controls inside its shadow root, without registering components or agent tools on the chess website.

- **`forms`**: I associated visible labels with native controls, following “always associate `<label>` with its input using `for` and `id`.”
- **`component-specific-light-dark-theme`**: I paired the explicit light scheme with explicit background/text colors, following “Do not set `color-scheme` on elements without a background”.
- **`form-factor-adaptation`**: I retained usable controls and container-based spacing at 320 pixels, following “Ensure text and controls are never clipped, squished to zero dimensions, or overflowing”.

## Previous release 1.1.0 verification — historical record

The English/Arabic interface, saved AI preferences, account-advertised thinking levels and Windows setup were verified with **86 unit/integration tests, 15 extension-browser checks and 21 UI-browser checks**. All passed. **No new live OpenAI or Chess.com requests were made for this release verification.** Earlier, separately authorized catalog/inference checks are recorded below and do not validate the new language or thinking settings against a live provider.

## Environment and baseline

- Windows; Node **26.4.0**; npm **12.0.2**; Git **2.55.0.windows.1**.
- Isolated official Chrome for Testing **145.0.7632.6**, Playwright **1.58.2**. No personal browser profile was used.
- `@ui-sdk/core` and `@ui-sdk/web` pinned to **0.1.0-beta.1** and bundled locally into the extension. No runtime CDN scripts are loaded.
- Original repository baseline: **`01b990b9424ac0eef905376b40d14faf8dd076c0`**. The initial checkout was clean, its 19 tests passed, and the baseline build passed. Original authorship, notices and Stockfish assets are retained. See [BASELINE.md](BASELINE.md).

## Current release results

| Command/check | Result |
| --- | --- |
| `scripts/setup.ps1` with installed dependencies | Exit **0**; completed tests, build and static checks using the repository root |
| `npm test` through the setup helper | **86 passed**: 19 original + 67 added; **0 failed, 0 skipped**; added-suite duration **2216.6952 ms** |
| `npm run build` | Exit **0**; generated **five JavaScript bundles**: content, background, offscreen, study and options; required license files copied |
| `npm run check` | Exit **0**; **38 JavaScript syntax checks**, manifest checks and all **five extension token-boundary checks** passed |
| `npm run test:browser` | Exit **0**; **15 checks passed**, no browser page errors |
| `npm run test:ui` | Exit **0**; **21 checks passed** in **13663 ms**, no browser page errors or external HTTP traffic |
| `npm audit --omit=dev` | Exit **0**; **0 known production-dependency vulnerabilities**, **35 dependency records** |
| `git diff --cached --check` | Exit **0** after removing one extra blank line at EOF; no staged whitespace errors |
| Original Stockfish assets | No staged or working-tree changes under `extension/engine` |
| PowerShell helper validation | Both scripts parsed; six invalid extension IDs rejected before companion execution; setup command sequencing, explicit-install flags, missing dependency/lockfile errors and caller-directory restoration passed with mocked npm |

The setup helper's real verification run used existing installed dependencies. Its `-InstallDependencies` command construction was checked separately with mocked npm: `ci`, disabled lifecycle scripts, no audit/fund requests, a repository-local cache, then test/build/check. Those command-construction tests did not download packages or access accounts.

The audit result is a point-in-time check of known production dependency advisories. It does not establish that application behavior or all development tooling is vulnerability-free.

## Unit and integration coverage

- **Chess input:** exact allowlists; legal/impossible FEN, turn consistency, castling, en passant, promotion/underpromotion, unique candidate cap and legal short variations.
- **Scores and estimates:** White-relative and side-to-move normalization, mate signs/distance ordering, Black ranking, bounded timing estimates, finite simulated weights and rounded totals of 100% across allowed settings.
- **Language and thinking:** English/Arabic allowlists, safe defaults for older payloads, separate saved interface/explanation preferences, serialized local preference writes, translated settings labels, Arabic plain-text output checks, default reasoning omission and explicit reasoning checked against the freshly fetched account catalog.
- **Catalog privacy and bounds:** server order and visibility filtering; only safe model names, slugs and supported reasoning metadata are projected; up to **256 models** and **61,440 characters** of projected JSON; separate **8 MiB** upstream catalog limit; hidden instructions and arbitrary metadata are not forwarded.
- **OAuth with mocks:** explicit consent, fresh state/nonce/S256 PKCE, exact redirect, app-issued client IDs, identity/JWT checks, denial, replay/expiry/duplicates, missing plan scope, invalid grants, separate accounts, rotating refresh, cancellation during exchange, sign-out during refresh and revocation outcomes.
- **Windows storage:** real DPAPI round trip and protected atomic save/reload using only synthetic records; owner/SYSTEM directory ACLs were exercised.
- **Companion access:** loopback-only bind, exact Host/origin/client checks, strict CORS, blocked arbitrary proxy routes, POST/JSON-only API, body/request limits, one active explanation and cancellation on disconnect.
- **Extension boundary:** account-management requests rejected from content clients, foreign senders and nested frames; human-game routes and missing consent rejected; only validated chess data forwarded.
- **Streaming and model output:** required completion, chunked SSE/CRLF, missing/mixed-case MIME headers, explicit incompatible MIME rejection, bounded JSON admission errors, cancellation/privacy of rejected bodies, interrupted/refused/failed/incomplete streams, late usage limits, malformed JSON, invented moves/replies and unsafe HTML.
- **Staleness:** board/settings generations, A→B→A changes, delayed answers, account switches and cancellation (including tabless study clients) prevent old responses from becoming current explanations.

## Real browser behavior, mocked services

The extension suite ran the **actual MV3 extension**, **bundled Stockfish WASM**, extension messaging/storage and loopback origin gate. Its 15 checks cover local analysis without sign-in, up to three legal candidates, a single stable arrow, repeat scans without replacing its SVG node, board flips and resize alignment, manual moves/undo, FEN rejection, delayed-response cancellation, a 390-pixel layout and a synthetic Chess.com adapter fixture. A human-game route could not enable training explanations.

The UI suite ran the **real ui-sdk web components** in an isolated extension browser with a synthetic account catalog and mocked OAuth/inference. Its 21 checks cover:

- Settings open without account or AI requests; model saving begins disabled; explicit refresh passes the real origin gate.
- Named controls, logical keyboard Tab navigation, Space-operated checkboxes, select dismissal/focus restoration, English/Arabic persistence and RTL layout at 390 pixels. Saved-status text changes language immediately, the narrow language control fits on one line, and the dropdown caret keeps its downward direction in RTL.
- Separate saved AI preferences, only advertised thinking levels, per-model reasoning selection and reset to default for a model that has no supported adjustable levels.
- ui-sdk agent snapshots and safe preference actions; agent actions cannot grant consent, enable sharing, sign in or access the account.
- Readable connection/catalog/consent failures, invalid model-save prevention and human-initiated mocked sign-in/cancellation.
- Actual Stockfish study analysis, three candidates and one arrow, board flipping/resizing, explicit forwarding of saved Arabic/high settings to a **mocked** explanation, and invalidation when preferences change.
- Malformed mocked AI HTML rejection, continued local analysis, and no external HTTP traffic or browser page errors.

Sampled contrast checks passed for primary/default/hover text, selected options, control boundaries and focus. In the captured UI evidence, sampled text contrast ranged from **8.85:1** to **14.67:1**, the sampled select border was **3.39:1**, and its focus outline was **6.07:1**. These are targeted measurements, not a full accessibility certification.

The test harness copies the built extension into ignored `work/`, changes only that test copy to use an automatically selected loopback port, and uses an isolated browser profile. It does not replace the installed extension or occupy the user's production companion port 43187.

An earlier isolated UI-browser launch timed out before its extension service worker appeared. Subsequent launches passed; the final recorded run above completed all 21 checks. No personal profile or relaxed account boundary was used to unblock it.

**OAuth, account catalogs and inference were mocked in these release tests.** Browser explanation text and account entries were synthetic; unit identity tokens were ephemeral test JWTs. **Chess.com content was mocked** with local board HTML. No live game, Chess.com account, production DOM or personal browser session was used. The retained Lichess logic has repository-test coverage, not new live browser coverage.

Public evidence contains only synthetic data:

- [Extension-browser results](docs/verification/browser-results.json)
- [UI-browser results and sampled contrast](docs/verification/ui-browser-results.json)
- [English study screenshot](docs/images/study-en.png)
- [Arabic settings screenshot](docs/images/settings-ar.png)

## Guidance and component verification

The interface work used the requested **modern-web-guidance** and **ui-sdk** skills. ui-sdk API/composition decisions came from the installed version's Markdown documentation and types; behavior was exercised through keyboard and agent-boundary browser checks. The library is unstyled by default; the project supplies local styles and explicit focus/selected states.

- **`forms`**: I used logical spacing and alignment so the same controls work in both language directions, following “use CSS logical properties (e.g., `margin-inline-start`) for RTL support.”
- **`accessibility`**: I kept controls in a coherent DOM sequence and tested keyboard reachability and focus restoration, following “Provide a logical tab order”.
- **`form-factor-adaptation`**: I placed size containment on wrappers and adapted their descendant layouts, following “A container query styles the container's descendants, never the container itself.” The one-column base remains usable when a container rule does not apply.

## Earlier authorized live checks — historical evidence

Before the 1.1.0 UI/language/thinking upgrade, the user separately authorized a read-only live account catalog check and up to three small live explanation attempts through the existing sign-in.

1. **One catalog request succeeded**, returning **eight selectable models** after the catalog-size repair. The old 256 KiB reader had rejected the larger provider catalog; the companion now uses its independent bounded reader.
2. **Two explanation requests were made.** The first reproduced `invalid_stream_type`: HTTP 200 with no Content-Type header, in **3690 ms**. After permitting an absent header only through the bounded SSE parser, required terminal completion and strict output validation, the second succeeded in **14832 ms** with **three schema-valid legal candidates**. No third attempt was needed.

Those requests used the existing active account/model, the starting FEN, local depth-12 candidate scores, short candidate variations, rating 1200 and a 60-second practice budget. No API-billing route, new credential registration or raw credential logging was used. They verified the companion/provider protocol at that time; they were not live Chrome or Chess.com tests.

**These earlier results do not verify the new Arabic explanation request or selectable reasoning effort against a live model.** The current release tested those paths only with mocks. No additional real account/catalog/inference calls were made during this UI upgrade. Historical development notes about an uncommitted or unpublished checkout describe that earlier stage, not the publication status of this release.

## Limits and remaining checks

- **Live Chess.com and Lichess:** current production page behavior was not tested. Site layout/animation changes can break board reading. A visible board does not prove turn or historical castling/en passant rights; use an explicit FEN when needed.
- **Live account coverage:** fresh OAuth registration, live denial/expiry/revocation, every model/account/workspace and the new language/reasoning options are not live-verified. Mock tests cannot establish eligibility or model quality.
- **Browser floor:** the manifest targets Chrome/Edge **120+**, but this verification executed **Chrome for Testing 145.0.7632.6 only**. Chrome 120 and Edge were not separately run.
- **Accessibility:** keyboard, labels, RTL, narrow layout and sampled contrast were tested. Screen-reader software and a full accessibility audit were not run.
- **Estimates:** complexity, thinking-time ranges and simulated choices remain uncalibrated estimates, not measured human behavior. The bot/page heuristic cannot establish opponent identity.
- **Trust:** schema checks cannot prove chess reasoning. The companion assumes a trusted Windows user and extension; DPAPI is not protection against malware acting as that same user. See [SECURITY.md](SECURITY.md).
- **Coding model:** the original requested coding-model selection could not be changed or independently verified through the chat controls. It is separate from the app's account-specific model picker.

See [Windows setup](WINDOWS-SETUP.md) for reproducible commands and [AI-agent setup](docs/AI-AGENT-SETUP.md) for an authorized local-setup workflow.
