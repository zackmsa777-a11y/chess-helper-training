# Security and estimation boundaries

## Architecture

Chess page → isolated extension content script → validated runtime message → extension service worker → loopback companion → official OpenAI endpoints.

Local study → the same Stockfish offscreen worker and training validation. No sign-in is needed for local evaluations, legal moves, estimated thinking time or optional simulated choice weights.

The companion has fixed routes for status, OAuth, catalog/model selection, first-use acknowledgement and chess explanations. It is not a general HTTP or model proxy. Request bodies cannot set a remote URL, system prompt, arbitrary input, tools, model parameters, headers or API keys. Content scripts cannot request account-management routes. No external extension-message handler is installed.

## Authorization and credentials

- The installed extension ID is explicitly supplied to the companion. HTTP binds only IPv4 loopback and verifies remote address, exact Host, exact extension Origin and client header. CORS allows only that origin and the required POST headers. No cookies are used. The only browser-navigation exception is the OAuth callback, authorized by single-use state.
- State, nonce and an S256 PKCE verifier are fresh for each attempt and expire after five minutes. Duplicate callback parameters, mismatched clients, denial, replay and expired state fail closed. Returning sign-in reuses the issued client ID and stable host ID. Optional token-bearing URL hints are deliberately omitted.
- ID tokens are verified with jose against OpenAI JWKS, including RS256 signature, issuer, audience, expiry, issued-at time, nonce and authorized party. An existing registration cannot be overwritten by a different verified subject. Plan permission is checked separately from identity.
- Refreshes are serialized; replacement credentials are written together. Terminal refresh failures clear unusable tokens while keeping registration mapping. Temporary network failures preserve credentials. Sign-out waits for a pending rotation before attempting revocation.
- Tokens exist only inside the companion and its DPAPI-encrypted record. They are not in the extension, browser/page storage, URLs, logs or source. The app prints no request bodies, OAuth callback URLs or upstream error bodies. Identity email, when present in a verified ID token, is used only in the account settings label and encrypted store, never model input.
- DPAPI and owner/SYSTEM ACLs protect against other Windows users. This is **not** a boundary against malware or an administrator controlling the same Windows account. A hostile local process can spoof HTTP headers; fixed chess-only routes, request validation and rate limits still apply. The extension's code and Windows account must be trusted.

## Data and inference

Both sides of the extension bridge and the companion validate an exact schema. Unknown fields are rejected. FEN syntax, kings, side to move, castling occupancy, en passant consistency, legal candidates and every supplied PV ply are checked with chess.js. Only up to three unique candidates and six plies per candidate are accepted. Scores explicitly use White perspective. UCI scores are normalized once, at the engine boundary; bound-only UCI scores are excluded. Mate scores are represented separately, and ambiguous mate-zero is not sent for a playable position.

The server obtains `GET https://api.openai.com/v1/models` with the active OAuth access token, displays only `visibility: list` entries in server order, and uses the selected slug. It rechecks availability for each explanation. Inference uses only `POST https://api.openai.com/v1/responses`, `store: false`, `stream: true`, an input array and a fixed developer instruction. There are no tools, browser context, uploaded files, persistent response IDs, API-key fallback, unsupported generation settings or automatic retries.

The upstream model catalog has its own 8 MiB bound because model metadata can be large. Only validated slug/display-name pairs and allowlisted reasoning capabilities leave the companion (at most 256 entries and 61,440 JSON characters, below the extension's 64 KiB character limit). OAuth responses retain the separate 64 KiB limit. A catalog size error does not sign the user out or trigger reauthorization.

Explanation language is limited to English or Arabic. Model thinking defaults to the model's own behavior, with no `reasoning` override. An explicit effort must be one of the documented Responses effort identifiers and present in the selected model's fresh account-catalog `supported_reasoning_levels` metadata. Unknown capabilities are not offered, and an unsupported effort fails before inference. The app does not assume which models or efforts a plan includes.

Incoming model output must match the strict schema and pass local validation. Candidate fields must match supplied legal moves; threat replies must match the candidate's supplied second ply. Extra fields, duplicate/invented moves, illegal replies, unsafe HTML, markup delimiters and notation in free prose are rejected. Prose is rendered with `textContent`, never `innerHTML`. Model claims about strategy can still be wrong; schema checks cannot prove chess reasoning.

Streams must reach `response.completed`; refusal, failed/incomplete events, interrupted streams, oversized streams and malformed JSON are errors. Limits: 12 KiB incoming body, 16,000 output-text characters, 1 MiB total stream, 60-second inference stream timeout, six explanation attempts/minute and 60/hour, 60 API requests/minute, one active explanation. Provider computation may continue briefly after local cancellation. No output is rendered until complete validation.

The request explicitly accepts `text/event-stream`. A missing response Content-Type, observed on the live direct route, is allowed only through the same bounded SSE parsing and terminal/output validation. Explicit incompatible MIME types fail; there is no JSON-success fallback. JSON error bodies are limited to 64 KiB and only safe error codes, parameter names, request IDs and enumerated shape/type metadata can leave the companion. Rejected non-JSON bodies are cancelled without returning their contents.

Board/settings generations invalidate pending responses, including an A→B→A position sequence. Site position is checked again before accepting an answer. Navigation and board changes cancel the local request. Ordinary scans and local engine updates do not trigger AI requests. A result is labeled as the requested snapshot; later deeper engine analysis is not silently treated as the source of that earlier answer.

## Estimates

These are pedagogical heuristics, **not measured human behavior or calibrated probabilities**. No Lichess database or human-game database is used.

- Tactical density counts capture/check/mate symbols in supplied legal PVs. Complexity is high at five such events or a top-two score gap of at least 150 centipawns, medium at two events or 50 centipawns, otherwise low. Missing candidates and shallow search limit this estimate.
- Thinking time starts at 12/22/38 seconds for low/medium/high and is multiplied by `1.4 - (rating - 400) / 4000`. The displayed range uses factors 0.6 and 1.5, clipped to the selected time budget. It is not model latency, a player prediction or a recommended time-control policy.
- Optional weights apply a softmax to side-to-move-relative scores, with temperature `max(25, 220 - (rating - 400) * 0.075)`. Mate outcomes outrank ordinary centipawn scores. Largest-remainder rounding makes displayed percentages total exactly 100. They describe only the displayed subset of candidates; no moves are sampled or played.
- AI complexity is a separate, explicitly labeled estimate conditioned on the supplied rating and local lines. The app does not infer player strength or claim these are population choice frequencies.

## Site and scope limitations

The old live-game heuristic is preserved and remains unreliable. New AI explanations accept local study or the Chess.com analysis/computer paths plus explicit practice confirmation. URLs/DOM cannot prove bot identity. No new autoplay, mouse automation, page injection of moves or expanded human-game assistance was added.

The page adapter infers turn, castling and en passant from incomplete information; some syntactically legal FENs can still be wrong for the real game. Board animations, site redesigns and SPA navigation can break scraping. The standalone study board with an explicit FEN is the most controlled path. This project has not been live-tested on Chess.com. The user explicitly authorized live catalog and explanation checks with the existing ChatGPT sign-in; the exact scope/results are in TEST-RESULTS.md.

## Documentation used (checked 2026-11-13)

- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/token-reference
- https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/website
- https://developers.openai.com/siwc/ui-ux-guidelines

This direct open-source flow uses the app's own dynamic registration. It does not read Codex/ChatGPT app credentials, reuse another application's client ID, or access private backend-api routes.
