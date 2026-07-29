import * as G from "./core.mjs";
const {SHIPS, keyFor, cellsFor, canPlace, makeBoard, makeShip, emptyGameState, reducer, fireAt, markShot, allSunk} = G;

let pass = 0, fail = 0;
const t = (name, cond, extra="") => { (cond?pass++:fail++); console.log(`${cond?"PASS":"FAIL"}  ${name}${extra?"  "+extra:""}`); };

const board = (...ships) => makeBoard(ships.map(([d,cells])=>makeShip(d,cells)));
const CARRIER=SHIPS[0], BATTLESHIP=SHIPS[1], CRUISER=SHIPS[2], SUB=SHIPS[3], DESTROYER=SHIPS[4];

console.log("--- 1. placement flush against edges and corners ---");
const empty = makeBoard();
t("Carrier horizontal flush to right edge (F1..J1 = x5..9,y0)", canPlace(empty, cellsFor(5,0,"horizontal",5)));
t("Carrier horizontal overhanging right edge (x6,y0) rejected", !canPlace(empty, cellsFor(6,0,"horizontal",5)));
t("Carrier vertical flush to bottom edge (x0,y5)", canPlace(empty, cellsFor(0,5,"vertical",5)));
t("Carrier vertical overhanging bottom (x0,y6) rejected", !canPlace(empty, cellsFor(0,6,"vertical",5)));
t("Destroyer in top-left corner horizontal (0,0)", canPlace(empty, cellsFor(0,0,"horizontal",2)));
t("Destroyer in bottom-right corner horizontal (8,9)", canPlace(empty, cellsFor(8,9,"horizontal",2)));
t("Destroyer in bottom-right corner vertical (9,8)", canPlace(empty, cellsFor(9,8,"vertical",2)));
t("Destroyer starting on last column horizontal (9,9) rejected", !canPlace(empty, cellsFor(9,9,"horizontal",2)));
t("Destroyer starting on last row vertical (9,9) rejected", !canPlace(empty, cellsFor(9,9,"vertical",2)));
t("no wrap-around: cells for (9,0)h size2 are 9,0 and 10,0", cellsFor(9,0,"horizontal",2).join("|")==="9,0|10,0");
// full-board reducer path for a corner placement
let s = emptyGameState();
s = reducer(s, {type:"PLACE", cell:"5,0"});   // Carrier flush right edge
t("reducer accepts Carrier flush to right edge", s.playerBoard.ships.length===1 && s.placementError==="");
let bad = reducer(s, {type:"PLACE", cell:"9,1"}); // Battleship overhang
t("reducer rejects Battleship overhang with an error and no placement",
  bad.playerBoard.ships.length===1 && bad.placementError.includes("cannot be placed"));

console.log("\n--- 2. two ships placed directly adjacent ---");
let b1 = board([CARRIER, cellsFor(0,0,"horizontal",5)]);
t("Battleship directly below Carrier (touching side-by-side) allowed", canPlace(b1, cellsFor(0,1,"horizontal",4)));
t("Cruiser end-to-end with Carrier in the same row allowed", canPlace(b1, cellsFor(5,0,"horizontal",3)));
t("Ship diagonally touching Carrier allowed", canPlace(b1, cellsFor(5,1,"horizontal",3)));
t("Ship overlapping Carrier by one cell rejected", !canPlace(b1, cellsFor(4,0,"horizontal",3)));
t("Ship crossing Carrier perpendicularly rejected", !canPlace(b1, cellsFor(2,0,"vertical",3)));
// via reducer, 5 ships all mutually adjacent, no gaps
let s2 = emptyGameState();
for (const [cell] of [["0,0"],["0,1"],["0,2"],["0,3"],["0,4"]]) s2 = reducer(s2,{type:"PLACE",cell});
t("all five ships placeable in five directly adjacent rows", s2.playerBoard.ships.length===5 && s2.placementError==="",
  `placed=${s2.playerBoard.ships.length}`);

console.log("\n--- 3. sinking a ship whose cells touch another ship ---");
// Cruiser row1 x0..2, Submarine row2 x0..2 (directly adjacent), Destroyer end-to-end with Cruiser
let bAdj = board([CRUISER, cellsFor(0,1,"horizontal",3)],
                 [SUB,     cellsFor(0,2,"horizontal",3)],
                 [DESTROYER, cellsFor(3,1,"horizontal",2)]);
let r, cur = bAdj, sunkEvents = [];
for (const c of cellsFor(0,1,"horizontal",3)) { r = markShot(cur, c); cur = r.board; sunkEvents.push(r.sunkShip); }
t("hits on the adjacent Cruiser all register as hits", cur.ships[0].hits.length===3);
t("Cruiser reports SUNK only on its third (final) cell",
  sunkEvents[0]===null && sunkEvents[1]===null && sunkEvents[2]==="Cruiser",
  `events=[${sunkEvents.map(String)}]`);
t("touching Submarine untouched by Cruiser's sinking", cur.ships[1].hits.length===0);
t("end-to-end Destroyer untouched", cur.ships[2].hits.length===0);
// shooting a cell of the neighbour right after does not re-sink the Cruiser
r = markShot(cur, "0,2"); 
t("first hit on neighbouring Submarine does not report a sink", r.sunkShip===null && r.hit===true);
// a cell diagonally adjacent to a ship is a miss, not a hit
r = markShot(bAdj, "3,0");
t("cell diagonally adjacent to Cruiser is a miss", r.hit===false && r.sunkShip===null);
// re-firing at an already-sunk ship's cell is rejected upstream by fireAt
let st = {...emptyGameState(), phase:"playing", currentTurn:"player", computerBoard: bAdj, playerBoard: bAdj};
let after = fireAt(st, "player", "0,1");
let again = fireAt(after, "player", "0,1");
t("re-firing the same cell is a no-op (state identical)", again===after);

console.log("\n--- 4. win condition fires on the exact final shot ---");
// build a full 5-ship enemy fleet, several ships adjacent
const fleet = [
  [CARRIER, cellsFor(0,0,"horizontal",5)],
  [BATTLESHIP, cellsFor(0,1,"horizontal",4)],
  [CRUISER, cellsFor(0,2,"horizontal",3)],
  [SUB, cellsFor(4,2,"horizontal",3)],
  [DESTROYER, cellsFor(8,9,"horizontal",2)],
];
const enemy = board(...fleet);
let g = {...emptyGameState(), phase:"playing", currentTurn:"player", computerBoard: enemy};
const allShipCells = fleet.flatMap(([,c])=>c);
let firedCount = 0, earlyWin = false;
for (const c of allShipCells) {
  g = fireAt({...g, currentTurn:"player"}, "player", c);
  firedCount++;
  if (g.phase === "gameover" && firedCount < allShipCells.length) { earlyWin = true; break; }
}
t("game does not end before the last ship cell is hit", !earlyWin);
t(`win fires on shot #${allShipCells.length} exactly (the final cell)`, g.phase==="gameover" && g.winner==="player" && firedCount===allShipCells.length,
  `phase=${g.phase} winner=${g.winner} shots=${firedCount}`);
t("turn is cleared on game over", g.currentTurn===null);
t("final sink message present", g.messages[0]==="You sank the enemy Destroyer!", `msg=${g.messages[0]}`);
// one cell short => still playing
let g2 = {...emptyGameState(), phase:"playing", currentTurn:"player", computerBoard: enemy};
for (const c of allShipCells.slice(0,-1)) g2 = fireAt({...g2, currentTurn:"player"}, "player", c);
t("17/17-1 cells hit leaves game in 'playing'", g2.phase==="playing");
t("allSunk() false with one cell remaining", !allSunk(g2.computerBoard));
// misses interleaved must not affect the win
let g3 = {...emptyGameState(), phase:"playing", currentTurn:"player", computerBoard: enemy};
let n=0;
for (const c of allShipCells) { g3 = fireAt({...g3,currentTurn:"player"},"player",c); n++;
  if (n<allShipCells.length) g3 = fireAt({...g3,currentTurn:"player"},"player",keyFor(0,9)); }
t("interleaved misses do not break the win condition", g3.phase==="gameover" && g3.winner==="player");
// reducer-level: winning shot goes through PLAYER_FIRE and never hands the turn to the computer
let g4 = {...emptyGameState(), phase:"playing", currentTurn:"player", computerBoard: enemy};
for (const c of allShipCells) g4 = reducer({...g4, currentTurn:"player"}, {type:"PLAYER_FIRE", cell:c});
t("PLAYER_FIRE path ends the game with winner=player", g4.phase==="gameover" && g4.winner==="player" && g4.currentTurn===null);

console.log("\n--- 5. loss condition on the computer's exact final shot ---");
let g5 = {...emptyGameState(), phase:"playing", currentTurn:"computer", playerBoard: enemy};
let m=0, endedEarly=false;
for (const c of allShipCells) {
  g5 = reducer({...g5, currentTurn:"computer"}, {type:"COMPUTER_FIRE", cell:c});
  m++;
  if (g5.phase==="gameover" && m<allShipCells.length) endedEarly=true;
}
t("computer win fires on its exact final shot", g5.phase==="gameover" && g5.winner==="computer" && !endedEarly);

console.log("\n--- 6. random placement invariants (10k fleets) ---");
let overlaps=0, oob=0, wrongCount=0, wrongSizes=0, adjacentSeen=0;
for (let i=0;i<10000;i++){
  const st2 = G.randomPlacement(emptyGameState(), "player");
  const ships = st2.playerBoard.ships;
  if (ships.length!==5) wrongCount++;
  const seen = new Set();
  for (const sh of ships){
    if (sh.cells.length!==sh.size) wrongSizes++;
    for (const c of sh.cells){
      const [x,y]=c.split(",").map(Number);
      if (x<0||x>9||y<0||y>9) oob++;
      if (seen.has(c)) overlaps++;
      seen.add(c);
    }
  }
  // do any two ships touch? (allowed, but confirm it happens so adjacency is exercised)
  const touch = ships.some((a,ai)=>ships.some((b,bi)=>bi>ai && a.cells.some(c=>{
    const [x,y]=c.split(",").map(Number);
    return b.cells.includes(keyFor(x+1,y))||b.cells.includes(keyFor(x-1,y))||b.cells.includes(keyFor(x,y+1))||b.cells.includes(keyFor(x,y-1));
  })));
  if (touch) adjacentSeen++;
}
t("no overlapping cells in 10k random fleets", overlaps===0, `overlaps=${overlaps}`);
t("no out-of-bounds cells in 10k random fleets", oob===0, `oob=${oob}`);
t("always 5 ships with correct sizes", wrongCount===0 && wrongSizes===0);
console.log(`INFO  fleets containing at least one adjacent ship pair: ${(adjacentSeen/100).toFixed(1)}%`);

console.log(`\n${pass} passed, ${fail} failed`);
