# Privacy — Chess Helper Training development upgrade

Updated 2026-11-13. This policy describes this local training upgrade; it replaces the original upstream statement that no network requests are made.

## Local analysis

Stockfish and chess.js run locally. Reading the board, checking legal moves, calculating evaluations, estimating thinking time and displaying simulated weights do not require sign-in or send positions to OpenAI. The base extension reads pieces, highlights, orientation and limited page information for its existing turn/live-game heuristics. That page information is not included in AI requests.

Original interface preferences remain in `chrome.storage.local` and the chess site's `localStorage`. Site scripts can read the latter; it contains only nonsecret interface preferences. Training rating/budget/weight choices are held in the current page session. Explicit position-sharing consent is kept in extension storage, never in the site's localStorage. The model choice is kept with the companion's account record.

Interface language, explanation language and the selected model's reasoning preference are stored in extension-local storage. Switching interface language does not contact OpenAI. Only the explanation language and selected reasoning effort accompany an explicit explanation request.

## Optional account connection and explanations

Only after explicit sign-in consent does the companion open the official OpenAI authorization page. OpenAI handles sign-in and its permission review. The companion stores each validated identity/client registration and OAuth tokens in `%LOCALAPPDATA%\ChessHelperTraining\accounts.dpapi`, encrypted by Windows DPAPI CurrentUser, with an owner/SYSTEM directory ACL. The stable host ID is stored there too. No credentials are read from other applications. Tokens are never returned to extension pages or content scripts, stored in browser storage, written in plaintext, or logged.

When you explicitly click **Explain position**, and position sharing is enabled, the companion sends only:

- validated FEN and side to move;
- at most three legal candidate moves, White-relative centipawn or mate scores, search depth and at most six legal PV plies per candidate;
- your selected training rating, thinking budget, simulated-weights setting, explanation language and model reasoning effort.

No usernames, account labels, email addresses, cookies, page URLs, unrelated page text, images, browsing history or arbitrary prompts accompany this input. The companion also sends a fixed chess-tutor instruction, structured output schema and the account-selected model identifier. Its OAuth token is sent only as authorization to official OpenAI endpoints. Model-catalog and token-renewal requests occur as part of explicit account or explanation actions.

Inference uses the documented Responses endpoint with `store:false` and `stream:true`. This setting is not a claim of zero provider retention or a replacement for OpenAI's applicable terms and privacy practices. There is no API-key billing fallback, analytics, telemetry, advertising, remote executable code or automatic AI call on board refresh. Responses are held in memory and shown as text; changed positions/settings invalidate pending answers.

## Permissions and controls

The extension retains access to Lichess/Chess.com for local board analysis, offscreen workers for Stockfish, and storage for preferences. The added host permission is the companion's fixed loopback address. The companion checks exact origin, client header and Host, limits request sizes/rates and exposes only fixed application routes.

The bundled ui-sdk bridge on extension settings can describe named controls and change local preferences. Account labels are hidden from that bridge. Sign-in, consent, account/model operations and position sharing are marked as requiring a person and refused by the bridge's action policy. No AI model runs inside that UI bridge, and no chess-page agent tools or autoplay are added.

To stop sharing, clear the position-sharing checkbox. To end account access, use **Sign out of active account**; the companion attempts remote refresh-session revocation and clears local tokens. If revocation cannot be confirmed, use ChatGPT Settings to disconnect the app. Uninstalling the extension alone does not revoke provider authorization. Stop the companion before deleting its app-owned data folder. Registration/host mappings are retained after normal sign-out so future sign-in does not register a new client unnecessarily.

The donation button, external donation link and bundled donation images have been removed.

## Polski — najważniejsze informacje

Stockfish i analiza lokalna nadal działają bez konta. Opcjonalna funkcja „Explain position” wysyła dane szachowe do OpenAI dopiero po świadomej zgodzie i kliknięciu przycisku. Wysyłane są FEN, strona na ruchu, maksymalnie trzy legalne ruchy, oceny, głębokość, krótkie warianty oraz wybrane ustawienia treningu. Nie są wysyłane nazwy użytkowników, ciasteczka, adres strony ani pozostała treść strony.

Tokeny pozostają wyłącznie w lokalnym programie towarzyszącym i jego pliku szyfrowanym przez Windows DPAPI. Nie trafiają do strony, rozszerzenia ani logów. Wylogowanie próbuje unieważnić sesję w OpenAI i usuwa lokalne tokeny. Ustawienia interfejsu pozostają lokalne. Szacunki trudności, czasu namysłu i wag wyboru ruchów nie są pomiarami zachowania ludzi.

See `SECURITY.md` and `WINDOWS-SETUP.md` for implementation details and limitations. This development upgrade is not affiliated with OpenAI, Chess.com, Lichess or Stockfish.
