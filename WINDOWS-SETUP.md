# Set up Chess Helper Training on Windows

[Back to README](README.md) · [الدليل العربي](docs/AR.md) · [AI-agent setup](docs/AI-AGENT-SETUP.md)

Start with local study. Add the companion and ChatGPT sign-in only if you want AI explanations.

## 1. Put the files in a permanent folder

On the [training repository](https://github.com/zackmsa777-a11y/chess-helper-training), choose **Code → Download ZIP**, extract it, and keep the extracted source folder somewhere you intend to leave it. Alternatively, clone that repository using its HTTPS URL. Do not load a ZIP directly into Chrome or overwrite an unrelated extension checkout.

The folder you need contains `package.json`, `README.md` and an **`extension`** subfolder. Built extension files are included. Moving that folder later can change the unpacked extension ID and require a companion restart with the new ID.

## 2. Add it to Chrome

1. Enter `chrome://extensions` in Chrome's address bar. For Edge, use `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the source folder's **`extension`** subfolder. Do not select the repository root or the ZIP.
5. Open the new extension's **Details → Extension options** and click **Open study board**.

Use Chrome/Edge **120 or newer**. Local study needs no Node.js, companion, sign-in or API key when you use the included build.

## 3. Try a position

Select a piece and then its highlighted destination to move manually. Use **Undo move**, **Flip board**, or **Start position** as needed. Open **Position tools** to choose **Promote a pawn to** before promoting a pawn, or paste a valid FEN under **Load a position (FEN)** and click **Load position**.

Stockfish shows up to three candidates. Select a candidate to show one arrow; repeated scans should not make it blink. White-relative scores are positive when White is favored. Mate scores are not pawn values.

Choose a player rating and your study thinking budget. The complexity, thinking-time range and optional move-choice weights are estimates, not measurements of human players. The budget is for your practice; the separate **AI thinking mode** setting affects AI requests.

For supported website analysis, open Chess.com's analysis or built-in computer page. The existing floating panel includes the training controls. Page detection cannot prove that the opponent is a bot. Do not use explanations or engine help against people. A page-derived FEN can infer turn/castling rights incorrectly; use the local FEN board when these details matter.

## 4. Prepare the optional companion

You need **Windows 10/11**, an already approved **Node.js 22.15+** installation with npm, and Windows PowerShell with .NET DPAPI available. Git is needed only if you clone or develop with Git. No administrator account, firewall opening, registry change, startup task or execution-policy change is required.

Open PowerShell in the source folder. You can right-click the folder in File Explorer and choose **Open in Terminal**, then select PowerShell. Confirm that `package.json` is present before running these commands.

The setup script installs exact lockfile dependencies only when you include `-InstallDependencies`. It disables package lifecycle scripts, stores the npm cache under this repository's `work` folder, then runs tests, build and static checks. It does not install Node.js or sign in.

```powershell
.\scripts\setup.ps1 -InstallDependencies
```

If dependencies are already installed, run `.\scripts\setup.ps1` to verify and build without reinstalling them.

If your policy prevents running `.ps1` files, do not bypass or weaken it. You can run these equivalent commands yourself using an approved Node installation:

```powershell
npm ci --ignore-scripts --no-audit --no-fund --cache .\work\npm-cache
npm test
npm run build
npm run check
```

The companion itself uses an authored PowerShell helper for encrypted storage. If policy blocks that helper, use your organization's approved signing/execution process before enabling AI. Local Stockfish still works.

## 5. Start the companion

Copy the **32-letter extension ID** displayed in the extension's account settings. Use that actual ID in this command; the text below is a placeholder:

```powershell
.\scripts\start-companion.ps1 -ExtensionId YOUR_32_LETTER_EXTENSION_ID
```

The launcher validates the ID and runs the companion from the correct source folder. It does not open a sign-in page. A manual equivalent is:

```powershell
npm run companion -- --extension-id YOUR_32_LETTER_EXTENSION_ID
```

Leave this terminal running while using AI explanations. The companion listens only on **`127.0.0.1:43187`**, allows the configured extension origin and client header, and prints a ready message. Use one companion instance. Stop it with **Ctrl+C**. It does not start automatically with Windows.

## 6. Sign in yourself

1. In **Settings**, click **Check connection & refresh models**. Nothing connects automatically when you open settings.
2. Select the sign-in consent box and click **Continue with ChatGPT**.
3. In the official authorization page, review the app and requested permission to use your ChatGPT plan. Approve or deny yourself.
4. Return to settings and click **Check connection & refresh models**. Choose an **Available model**, then click **Use selected model**.
5. In **Your learning preferences**, choose **AI explanation language** and **AI thinking mode**. Leave **Model default (recommended)** or select one of the model's advertised levels, then click **Save preferences**. Wait for **Preferences saved.**
6. Enable **Allow position sharing when I click Explain position**. On the training board, confirm local analysis or a built-in bot, then click **Explain position**.

The **Interface language** control at the top of the study/settings page switches immediately between English and Arabic, including right-to-left layout. It does not change your AI explanation language. Save explanation language and thinking mode with **Save preferences**. Using a different model resets its thinking mode to the default; select and save a supported level again if desired.

Each explicit explanation uses the selected eligible account's ChatGPT plan. Availability and usage limits depend on the account and workspace. Review **Manage ChatGPT usage** for provider-side plan/credit settings. There is no API-key billing fallback, automatic model substitution or repeated call on every board refresh. A denied permission, unsupported option or usage limit stops that explanation; local Stockfish remains available.

Adding another account registration does not silently replace the active account. Switching requires validated sign-in. If you previously declined plan permission and now want to enable it, open **Permission options** and select **Ask for plan permission again after an earlier decline** before continuing. Repeated sign-in is not a fix for policy limits or malformed responses.

## Updates and restarts

- **Source or extension update:** build if needed, open `chrome://extensions`, click the extension's reload button, then reopen its settings/study page or refresh the affected chess page.
- **Companion update:** stop its terminal with Ctrl+C, then start it again from the updated source with the same extension ID. Existing encrypted sign-in is retained.
- **Moved/reinstalled extension:** check its ID and start the companion with the ID now shown in settings.

Do not overwrite unrelated local changes. Developers should inspect `git status` and repository instructions before updating.

## Credential storage and sign-out

The companion creates `%LOCALAPPDATA%\ChessHelperTraining\accounts.dpapi`. Windows DPAPI encrypts the complete record for the current Windows user; the directory allows that user and SYSTEM. Tokens do not enter extension storage, content scripts, logs or this repository. Do not copy this file into an issue, prompt or public repository.

Use **Sign out of active account** to clear local tokens and attempt remote refresh-session revocation. If the UI cannot confirm remote revocation, disconnect the app in ChatGPT settings. Clearing Chrome extension data alone does not revoke authorization. Stop the companion before removing its app-data directory. DPAPI records do not transfer to another Windows user/computer.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Chrome cannot load the extension | Extract the ZIP and select the `extension` subfolder containing `manifest.json`. |
| Companion unavailable | Keep its terminal open and compare the extension ID. Use `127.0.0.1`, not `localhost`. Check whether another instance occupies port 43187. |
| No models or plan permission denied | Refresh once. Review the selected registration and permission. Account policy/availability can prevent plan use; the app does not bypass that limit. |
| No extra thinking modes | Keep the default. Only reasoning efforts returned for the selected model are offered. |
| Explanation language or thinking choice did not stick | Click **Save preferences**. After choosing a different model, choose a supported thinking mode again if needed. |
| `response_too_large` on an old build | Update/restart the companion. The catalog has a separate bounded reader; repeated sign-in does not enlarge it. |
| `invalid_stream_type` on an old companion | Update/restart it. The reader accepts a missing Content-Type only with validated streamed events and completion. |
| Incomplete/malformed explanation or a changed position | No answer is displayed. Check the current board and request again explicitly when appropriate. There is no automatic retry. |
| Protected-storage PowerShell error | Follow the approved PowerShell signing/execution process. Do not disable security policy or store tokens in plaintext. |
| Wrong turn/castling rights on a website | Correct the FEN in local study. A visible board does not contain complete game history. |

## Browser verification

`npm test` runs repository logic and integration tests. OAuth and provider inference in these tests are mocked. Windows storage tests use synthetic records. They do not sign in or use a real ChatGPT allowance.

The extension browser test uses an isolated Chromium profile, the real unpacked extension and Stockfish, a local mocked companion, and synthetic Chess.com page content. It copies the extension into ignored `work/` and changes only that temporary copy to use an automatically chosen loopback test port. The installed extension and a running companion on port 43187 stay untouched. It does not test a live Chess.com game or your normal browser profile. Screenshots/results are written to `test-results` and temporary profiles to `work`.

The separate UI suite checks the redesigned interface with mocked services, including language/RTL and agent interactions. Neither browser suite requires real sign-in. Do not terminate an unrelated process to unblock a test.

Use an already approved Chrome for Testing/Playwright Chromium binary:

```powershell
$env:CHESS_TEST_BROWSER = 'C:\approved-path\chrome-win64\chrome.exe'
npm run test:browser
npm run test:ui
```

If no approved binary is available, obtaining and running the official Playwright browser requires the applicable software-download/execution approval. The optional installation commands are:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD 'work\playwright-browsers'
npx playwright install chromium
npm run test:browser
npm run test:ui
```

Keep mocked and live checks separate in reports. The previously authorized real catalog and explanation checks, their exact scope and the remaining live-site limits are recorded in [TEST-RESULTS.md](TEST-RESULTS.md).

## For developers

The original baseline is `01b990b9424ac0eef905376b40d14faf8dd076c0`. Build from the committed lockfile with `npm ci --ignore-scripts`; use `npm test`, `npm run build` and `npm run check` after relevant edits. All extension code and ui-sdk components are bundled locally under Manifest V3. Do not add remote runtime scripts or expose credentials to the extension. See [AGENTS.md](AGENTS.md), [security](SECURITY.md), [privacy](PRIVACY.md) and [test results](TEST-RESULTS.md).
