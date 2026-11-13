# Development baseline

- Source: https://github.com/dzejson91/chess-helper-chrome-extension
- Actual baseline: `01b990b9424ac0eef905376b40d14faf8dd076c0` (main), inspected 2026-11-13.
- Matches the commit in the previous audit.
- Fresh clone in `outputs/chess-training-dev`; initially clean. No AGENTS.md in this repository or applicable parent directories.
- No matching checkout found in the task workspace, Documents, Desktop or Downloads. Older ChessAssist downloads were left untouched.
- Before edits: all 19 existing tests passed; baseline build passed. Building regenerated `extension/content.js`.
- No credentials accessed, no upstream push or publication.

## Interface direction

Retain the familiar compact panel and existing controls. Add a quiet chess study section with a single selected move on the board, a list of up to three candidates, and plain-language estimates. Segoe UI body type, tabular numbers for scores. Palette: slate #1f2229, paper #f4f6fa, muted #b7c0ce, blue #9cc8ff, teal #83d9c0. Keep everything left aligned. No animation in the training section; reserve color for candidate selection and focus. Account settings have a separate, light, readable extension page.
