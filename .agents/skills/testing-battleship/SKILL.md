---
name: testing-battleship
description: How to run and end-to-end test the single-file browser Battleship game (React 18 + Babel standalone, no build step) locally in Chrome.
---

# Testing the single-file Battleship game

## Serving the app
The whole app is one static file (`index.html`) using React 18 + Babel standalone from CDN — there is no build step and no package manager.

```bash
cd /path/to/repo && python3 -m http.server 8080
# open http://localhost:8080/index.html in Chrome
```
Opening the file with `file://` may break the CDN/Babel transform, so always serve over HTTP.
Network access to the React/Babel CDNs is required; if the page renders blank, check that the CDN scripts loaded.

## Useful selectors / DOM hooks
Every board cell is a button with an accessible label, which makes state assertions easy from the
stripped DOM returned by the computer-use tool (no devtools needed):
- `button[aria-label="Your cell <col>,<row>"]` and `button[aria-label="Enemy cell <col>,<row>"]` (1-indexed, col first).
- Cell text content is the state: empty = unfired, `•` = miss, `✕` = hit. Ship cells on your own grid are grey via CSS class.
- Header counters: `N/5 placed` (Your Fleet) and `N/100 fired` (Enemy Waters).
- Phase can be read from the aside: `Placement phase` / `Your turn` / `Final report`.

## Driving a full game
- Placement: press `R` or click the `Rotate: horizontal|vertical` button; hover a cell for the preview (cyan valid / red invalid); click to place. `Random placement`, `Reset placement`, and a `Start game` button disabled until 5/5 placed.
- Play: the computer replies ~600 ms after each player shot. Click Enemy Waters cells with **≥1 s between clicks** — faster clicking can land while it is the computer's turn and be ignored.
- A deterministic row-by-row sweep (A→J for each row) reliably finishes a game in ~90 shots and takes ~7 minutes of wall clock. Do this with real UI clicks (batch ~10 clicks + waits per tool call), not with JS injected into the console — console-driven clicking is confusing in a recording and can outrun the turn timer.
- The winner is not deterministic: the computer fires randomly, so a sweep may end in `Victory!` or `Defeat`. If you must demonstrate a specific ending, plan for the possibility of replaying, or report which branch you observed.
- Sink announcements appear in the Message log as `You sank the enemy <Ship>!` / `The enemy sank your <Ship>!`, and Fleet status shows the ship struck through with `SUNK`. The log is a small scrollable list that only keeps recent entries visible — screenshot it as soon as a sink happens or you will lose the message.

## Console expectations
The only expected console output from the app is the Babel warning:
`You are using the in-browser Babel transformer...`. Anything else (errors/warnings) is a failure.
Note that the computer-use tooling itself emits a `[log]` line with cell coordinate mappings — do not
count that as app output.

## Devin Secrets Needed
None — the app is fully local and unauthenticated.
