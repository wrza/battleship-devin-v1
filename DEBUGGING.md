# DEBUGGING.md

A post-hoc audit of this repository, written from the artifacts only (commit
diffs + running the extracted game logic), not from memory of building it.

Method:

- every commit was diffed against its parent, and the two substantive
  revisions of `index.html` were compared after normalising whitespace, so
  that logic changes could be separated from the reformat that happened in the
  same commit;
- the pure game logic (`SHIPS` … `reducer`, lines 367–571 of `index.html`) was
  extracted verbatim from both revisions into Node modules and executed. The
  harness lives in `debug/` and reproduces every number quoted below:

  ```bash
  git show 2f3c561:index.html > /tmp/old.html
  node debug/extract.mjs index.html debug/core.mjs      # HEAD logic
  node debug/extract.mjs /tmp/old.html debug/core_old.mjs # pre-fix logic
  node debug/tests.mjs        # 37 behavioural assertions against HEAD
  N=20000 node debug/sim.mjs  # before/after turn-loop simulation
  ```
- the deployed page at https://wrza.github.io/battleship-devin-v1/ was fetched
  and byte-compared with `index.html` at HEAD: they are identical, so findings
  about HEAD apply to the live site.

## Commit-by-commit: what actually changed

| Commit | Message | What the diff actually does |
| --- | --- | --- |
| `c31d6c9` | Initial commit | README stub only. |
| `2f3c561` | Build browser Battleship game | Whole game in one minified `index.html`, README, `.gitignore`. Also silently installs `console.warn = () => {}` (see Bug 2). |
| `4f73ea1` | Fix computer targeting and format game | 848/35 lines, mostly Prettier. Four real behavioural changes, only one of which the message mentions: the AI target-board fix (Bug 1), the `useEffect` dependency change (Bug 1b), removal of the `console.warn` gag (Bug 2), and a UI string change `"Fleet Lost"` → `"Defeat"` (undocumented, cosmetic). Everything else is formatting — verified by normalised diff. |
| `c868dfc` | Add `.nojekyll` to serve files verbatim on GitHub Pages | Adds an empty file. Behaviourally a no-op for this repo (see Bug 3). |
| `327c676` (branch `devin/update-skills-1785344456`, **not merged**) | Add testing skill | Adds `.agents/skills/testing-battleship/SKILL.md`. Contains two documented workarounds for unfixed defects (Bugs 4 and 5). |

---

## Bug 1 — the computer aimed at the wrong board (severity: critical, fixed)

**What I saw.** In `2f3c561` the AI chose its target from the cells that had
*not yet been fired at on the enemy board* — i.e. it filtered by the player's
own shot history:

```js
function chooseComputerShot(gameState){ const fired=new Set(gameState.computerBoard.shots); ... }
```

`computerBoard` is the board the *player* shoots at. The computer shoots at
`playerBoard`. So the AI's "already tried" set was the player's shots, and its
own shot history was ignored entirely.

**What I expected.** Each computer shot lands on a cell of `playerBoard` that
the computer has not already fired at, and every cell stays reachable.

**Two compounding real-world effects, measured.** `debug/sim.mjs` plays 20,000
full games per revision through the real reducer, with the player sweeping
A1→J10 (the deterministic strategy the repo's own testing skill recommends):

| | before fix (`2f3c561`) | after fix (`4f73ea1`) |
| --- | --- | --- |
| computer shots per game | 87.5 | 86.4 |
| wasted (repeat) shots per game | **38.8 — 44.3% of all its shots** | 0.0 — 0% |
| distinct cells it managed to shoot | 48.7 / 100 | 86.4 / 100 |
| player ships sunk per game | **0.96 / 5** | 3.38 / 5 |
| games won by the computer | **0 / 20,000** | 5192 / 20,000 (26.0%) |

So the game was not merely "slightly easy": the opponent essentially could not
win — across 22,000 simulated games (a 20,000-game run plus an earlier
2,000-game run) it won exactly once, ~0.005%. Nearly half of its turns were no-ops (`fireAt` returns
the state unchanged for an already-shot cell, yet the turn still passes back
to the player), and any cell the player had fired at on the *enemy* board
became permanently immune on the *player's* board. The visible symptom was a
computer that repeatedly re-fired at cells it had already marked and that
never finished a fleet.

**Cause.** A single wrong property name — the two boards are symmetric shapes
(`{ships, shots}`) with no type distinction, so reading the wrong one is
silent. The comment above the function (`this is the only function that
chooses a target`) did not say *which* board it is choosing on.

**Fix.** `4f73ea1` reads `gameState.playerBoard.shots` and the comment now
names the board. Verified: 0 wasted shots in 20,000 games.

### Bug 1b — the effect dependency (severity: low, fixed in the same commit)

The turn-loop effect's dependency list changed from
`gameState.computerBoard.shots.length` to `gameState.playerBoard.shots.length`.
Both work in practice, because the effect is re-armed by the
`currentTurn` flip; the old list was watching the wrong side's history for the
same reason as Bug 1. The dependency list is still not exhaustive (it reads
all of `gameState` but lists three fields), which is a latent staleness hazard
if the reducer ever stops flipping `currentTurn` on every shot.

---

## Bug 2 — `console.warn` was globally disabled to hide a warning (severity: high, fixed — and it is exactly the kind of change you asked me to flag)

**What I saw.** The first working commit shipped this in `<head>`, before
Babel loads:

```html
<script>window.__battleshipConsoleWarn=console.warn;console.warn=()=>{};</script>
```

**What I expected.** No production code silencing a whole console channel.

**Cause.** `@babel/standalone` prints `You are using the in-browser Babel
transformer…`. That warning is *correct* — this page really does compile JSX in
the browser. The line suppressed the symptom instead of accepting it (or
removing the need for it by precompiling).

**Impact.** It was a global monkey-patch, so it also swallowed every React
warning for the lifetime of the page — key warnings, deprecated-API warnings,
`act()` warnings, anything. Any console-based verification of this app was
worthless while it was in place: a reviewer checking "no warnings in the
console" would have seen a clean console by construction. Calling this
"formatting cleanup" would be wrong; it was a symptom-suppression hack.

**Fix.** `4f73ea1` deletes the line (never mentioned in its commit message).
HEAD contains no `console.warn` reference — confirmed by grep on both the repo
file and the live page. The Babel warning is now visible, and the skill file
correctly documents it as the one expected console line.

---

## Bug 3 — `.nojekyll` (severity: none; a change that could not have fixed anything)

`c868dfc` adds an empty `.nojekyll`. Jekyll only removes files/directories
whose names begin with `_` (plus a handful of special cases). This repo
contains `index.html`, `README.md`, `.gitignore` — nothing Jekyll would have
dropped. So the commit is harmless and reasonable as a precaution, but it
changed no observable behaviour, and if the Pages site was misbehaving at the
time, this was not the cause. I am flagging it because the commit message
implies a fix.

---

## Bug 4 — player clicks during the computer's turn are silently swallowed (severity: medium, **still present at HEAD**, worked around in documentation)

**What I saw / reproduced.** The computer fires on a 600 ms `setTimeout`. While
`currentTurn === "computer"`, `PLAYER_FIRE` returns the previous state object
by reference:

```
reducer({...state, currentTurn:"computer"}, {type:"PLAYER_FIRE", cell:"0,0"})
  -> returns the identical state reference; 0 shots added; no message logged
```

**What I expected.** Either the click is queued and fired when the turn comes
back, or the UI tells the player the shot was ignored.

**What actually happens.** Nothing at all: no shot, no message, no error. The
cell also loses its `clickable` class during the computer's turn, so the only
feedback is a cursor change. A player clicking at a normal pace loses roughly
every other shot with no explanation.

**Cause.** The guard is correct for state integrity but has no user-facing
branch, and there is no input queue.

**How it was "fixed": it wasn't.** The unmerged skill file works around it by
telling the tester to slow down:

> Click Enemy Waters cells with **≥1 s between clicks** — faster clicking can
> land while it is the computer's turn and be ignored.

That is a test-harness accommodation for a product defect. The defect is in
`index.html` at HEAD.

---

## Bug 5 — sink announcements can scroll out of the log (severity: low, still present, worked around in documentation)

`addMessage` keeps 12 entries and the log panel is a short scrollable list, so
a `You sank the enemy Cruiser!` line is pushed out of view within a few shots.
`Fleet status` compensates for the *player's* fleet only; there is no
persistent record of which *enemy* ships have been sunk (the enemy fleet list
is deliberately hidden, but sunk ships need not be). The skill file again
documents a workaround — "screenshot it as soon as a sink happens or you will
lose the message" — rather than the app persisting the information.

---

## Bug 6 — latent: the AI can return `undefined` and record a phantom shot (severity: low, still present at HEAD)

If every cell of `playerBoard` has been fired at, `chooseComputerShot` returns
`undefined`; `COMPUTER_FIRE` then happily appends `undefined` to
`playerBoard.shots` and logs "The enemy shot missed.":

```
chooseComputerShot(fully-shot board) -> undefined
COMPUTER_FIRE(undefined) -> playerBoard.shots.length becomes 101, phase still "playing"
```

Unreachable in a normal game (the game ends before 100 computer shots), so no
user has hit it, but there is no guard and it corrupts the shot list silently.
Same class of bug as Bug 1: no validation on the target cell.

---

## Current-code test results (the classic Battleship failure modes)

`node debug/tests.mjs` — 37 assertions, **37 pass, 0 fail** against HEAD.
What was tested, including what passes:

**Legal placement flush against edges and corners — all pass.**
Carrier horizontal at x=5 (occupying the last five columns), Carrier vertical
at y=5 (last five rows), Destroyer in the top-left and bottom-right corners in
both orientations. Overhangs are correctly rejected: Carrier at x=6/y=6,
Destroyer starting on the last column horizontally or the last row vertically.
There is no wrap-around — `cellsFor(9,0,"horizontal",2)` yields `9,0` and
`10,0`, and `inBounds` rejects it, rather than folding back to column 0. The
rejection path also goes through the reducer correctly: an error message is
shown, `placementIndex` does not advance, and no ship is added.

**Two ships placed directly adjacent — all pass.**
Ships may touch: side-by-side rows, end-to-end in the same row, and diagonal
contact are all accepted (`canPlace` checks overlap only, which is the
standard rule). Genuine overlaps — one shared cell, or a perpendicular
crossing — are rejected. All five ships can be placed in five directly
adjacent rows. Across 10,000 random fleets: 0 overlapping cells, 0
out-of-bounds cells, always 5 ships of correct length, and ~81% of fleets
contain at least one touching pair, so the adjacency path is exercised
constantly in real play.

**Sinking a ship whose cells touch another — all pass.**
With Cruiser at row 1 (x0–2), Submarine directly below at row 2 (x0–2) and
Destroyer end-to-end at row 1 (x3–4): hitting the Cruiser's three cells
reports `sunkShip` as `null, null, "Cruiser"` — the sink fires on the final
cell and only for the correct ship. The touching Submarine and the end-to-end
Destroyer register zero hits; the first hit on the neighbour reports a hit but
no sink; a diagonally adjacent cell is a miss. Re-firing an already-shot cell
is a no-op returning the identical state, so a sunk ship cannot be
double-counted.

**Win condition on the exact final shot — all pass.**
With a full 17-cell enemy fleet (several ships adjacent), the game stays in
`playing` for shots 1–16 and flips to `gameover, winner: player` on shot 17,
never earlier — verified both through `fireAt` and through the `PLAYER_FIRE`
reducer path, and with misses interleaved between every hit. `allSunk` is
false with one cell remaining. On game over `currentTurn` is set to `null`, so
the pending computer shot cannot fire after the win, and the final message is
the correct sink line. The mirror case passes too: the computer's win fires on
its exact final shot. `allSunk` also guards on `ships.length === 5`, so an
empty or partially placed board cannot trigger a phantom victory.

Nothing in these four classic areas fails at HEAD. The defects that remain are
Bugs 4, 5 and 6 above — input handling and validation, not board geometry.

## Summary

| # | Defect | Severity | Status at HEAD |
| --- | --- | --- | --- |
| 1 | AI targeted the wrong board: 44% wasted shots, ~0% win rate vs 26% after | Critical | Fixed in `4f73ea1` |
| 1b | Effect dependency watched the wrong board; still non-exhaustive | Low | Fixed / latent |
| 2 | `console.warn` globally disabled to hide the Babel warning | High (suppression) | Fixed in `4f73ea1` |
| 3 | `.nojekyll` presented as a fix; no behavioural effect | None | Present, harmless |
| 4 | Clicks during the computer's 600 ms turn silently dropped | Medium | **Open**, worked around in SKILL.md |
| 5 | Sink announcements scroll out of the 12-entry log | Low | **Open**, worked around in SKILL.md |
| 6 | `chooseComputerShot` can return `undefined`, recording a phantom shot | Low (latent) | **Open** |

The one commit that claimed a fix did fix the important bug, but it shipped
three further behavioural changes hidden inside an 848-line reformat, one of
which was the removal of a console-suppression hack that should never have
been committed in the first place. Both of those are process failures in my
earlier work on this repo: the suppression, and the decision to reformat the
entire file in the same commit as the fix, which made the fix effectively
unreviewable.
