---
name: testing-battleship
description: How to run and browser-test the single-file React battleship app (index.html) — serving it, grid pixel mapping, fast full-game sweeps, and where its known behaviours show up in the UI.
---

# Testing battleship-devin-v1 in the browser

## Serve it
No package manager, no build, no credentials. Babel transforms in-browser, so `file://` may break:

```bash
cd <repo> && nohup python3 -m http.server 8080 >/tmp/http.log 2>&1 &
# open http://localhost:8080/index.html
```

Maximize Chrome first: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

## Grid coordinates
In a maximized 1024x768 window at default zoom, cells are ~23px:
* Player cols x = 174,197,220,242,265,288,311,334,357,380
* Enemy cols x = 446,469,492,514,537,560,583,606,629,652
* Rows y = 236,259,282,305,328,351,374,397,420,443

More robust than pixels: every cell is a button with `aria-label="Your cell X,Y"` /
`"Enemy cell X,Y"` (1-based), and the returned page HTML shows `✕` for hits, `•` for misses.
Use that HTML (not screenshots) to count markers, read `N/100 fired`, and read Fleet status.

## Playing a full game
A row-by-row A→J sweep of Enemy Waters ends in ~85-95 shots. The computer fires on a 600 ms timer,
so leave **≥1.2 s between clicks**; batching 4-5 clicks with 1.4 s waits per tool call works well.
Budget ~10 minutes of wall clock. To check "gameover on the exact final shot", count enemy `✕`
markers (17 ship cells total) in the HTML and stop one short before the final click.

## Behaviours worth checking / likely still true
* Clicks during the computer's turn are silently dropped (`PLAYER_FIRE` returns state unchanged when
  `currentTurn === "computer"`): two clicks <1 s apart increment `N/100 fired` by only 1, with no error.
* The message log is capped at 12 entries, so sink announcements scroll away; Fleet status tracks only
  the player's fleet, so there is no persistent record of sunk ENEMY ships.
* Placement rejection shows `The <Ship> cannot be placed there. Move it fully on the board without
  overlapping another ship.` with the ship-list index unchanged; adjacent (touching) ships are legal.
* Expected console output is only the in-browser Babel warning. If you see React warnings, that's a
  finding; verify no `console.*` override exists with `grep 'console\.' index.html`.
* Post-gameover, verify no extra computer shot by comparing the count of non-empty
  `[aria-label^="Your cell"]` buttons before and after a few seconds.

## Devin Secrets Needed
None.
