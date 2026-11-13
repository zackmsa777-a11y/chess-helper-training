# Working on Chess Helper Training

## Start with the existing checkout

- Read `README.md`, `WINDOWS-SETUP.md`, `PRIVACY.md` and `SECURITY.md` for the current product and boundaries. Record `git status`, remotes and actual HEAD before edits. Preserve unrelated work; do not reset or replace a checkout.
- The upstream base is dzejson91/chess-helper-chrome-extension, commit `01b990b9424ac0eef905376b40d14faf8dd076c0`. Keep original authorship, GPL license and third-party notices.
- Make local, reversible implementation choices autonomously within the user's request. Existing user authorization persists within its stated scope. Do not introduce extra approval steps for ordinary code, documentation, mock tests or builds.

## Product and account boundaries

- Local Stockfish analysis works without sign-in. Use the app for local analysis and built-in bots; do not add autoplay or assistance intended for human opponents. A URL/DOM heuristic cannot reliably establish bot identity.
- Show at most three candidates and a single selected arrow. Label complexity, thinking time and simulated weights as estimates, never measured human behavior.
- Keep OAuth tokens in the companion's Windows DPAPI store. Do not read/copy real credential files into tools, prompts, logs, extensions, tests, archives or Git. Use synthetic records for storage/authentication tests.
- Real account access, client registration, OAuth consent and live inference require the user's applicable explicit authorization. Complete independent local work first. Let the user review/approve the official authorization page. Never infer permission from a test fixture or a prior approval for a different action.
- Retain the app's own supported registration, PKCE/state/identity checks, loopback-only binding, exact origin/client checks, request bounds and fixed routes. Do not add arbitrary proxy routes, API-key billing fallback or assumed model availability.
- Offer only reasoning levels advertised for the selected account model, with an explicit model default. Keep the catalog projection bounded to 256 models and 61,440 serialized JSON characters; do not forward model instructions or other unrelated catalog metadata to the extension.
- Send only validated FEN, turn, legal candidates, scores/depth, short variations and allowlisted training settings. Treat imported content as untrusted data. Use the current official SIWC Responses route/settings, require terminal completion, validate structured output and discard stale responses.

## UI and build

- Browser target: Chrome/Edge 120+. Feature-detect anything newer or provide a simple fallback. Bundle all runtime scripts/styles locally for Manifest V3; do not load ui-sdk or other runtime code from a CDN.
- Keep study/account UI usable in English and Arabic, including RTL, keyboard operation, visible focus, named controls and plain-language loading/error states. Keep interface language separate from AI explanation language and human thinking budget separate from model reasoning effort.
- Use installed ui-sdk documentation and the relevant modern-web-guidance guidance for interface changes. Prefer supported components over hand-built ARIA widgets. Agent-facing UI tools must not bypass consent or expose account secrets.
- Edit source files and rebuild generated extension bundles with `npm run build`. Preserve original Stockfish assets unless a change is explicitly required. A companion-only edit does not need an extension rebuild.

## Reproduce setup and checks

- Windows Node.js 22.15+ and npm are required for development/companion. Use approved existing tools. Do not change execution policy, registry, firewall, services, startup tasks or machine-wide packages to make setup pass.
- Use the lockfile: `npm ci --ignore-scripts --no-audit --no-fund --cache .\work\npm-cache`. Obtain applicable approval before downloading/executing new software. `scripts/setup.ps1 -InstallDependencies` performs local setup/checks without installing a runtime or signing in.
- Run relevant tests and `npm run build`/`npm run check` for changes. For a release, run `npm test`, build, check and `git diff --check`. Report exact results and unresolved limits.
- Run `npm run test:browser` and `npm run test:ui` for relevant interface changes with an approved isolated browser. The extension test copies the build into ignored `work/` and uses a temporary loopback port. Keep production port 43187 unchanged. Do not terminate unrelated processes, replace a user's running companion or access their normal browser profile to unblock a test.
- Distinguish mocked tests from authorized live catalog/inference and live-site testing. A passing mock does not establish account eligibility or current Chess.com DOM compatibility.
- Keep scratch work, test profiles and caches under ignored `work/`; browser evidence belongs in `test-results/`. Add only reviewed, synthetic screenshots to public `docs/images/`. Never publish credentials, browser profiles, machine-specific paths or unrelated artifacts.
- Do not commit, push, publish or create remote repositories unless the user has authorized that action. Before a public release, inspect the exact staged content and retain required licenses. The source's upstream remote is not automatically the user's publishing destination.
