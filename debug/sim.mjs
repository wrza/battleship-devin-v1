import * as NEW from "./core.mjs";
import * as OLD from "./core_old.mjs";

// Simulate the full turn loop the App useEffect implements, for both revisions.
// Player sweeps the enemy board row by row (the deterministic strategy the
// repo's own testing skill recommends).
function playGame(G, seed) {
  let s = G.reducer(G.randomPlacement(G.emptyGameState(), "player"), {type:"START"});
  // START already randomly places the computer fleet
  let order = [];
  for (let y=0;y<10;y++) for (let x=0;x<10;x++) order.push(G.keyFor(x,y));
  let wastedComputerShots = 0, computerShots = 0, undefinedTargets = 0;
  for (const cell of order) {
    if (s.phase !== "playing") break;
    s = G.reducer({...s, currentTurn:"player"}, {type:"PLAYER_FIRE", cell});
    if (s.phase !== "playing") break;
    const target = G.chooseComputerShot(s);
    const before = s.playerBoard.shots.length;
    if (target === undefined) undefinedTargets++;
    s = G.reducer({...s, currentTurn:"computer"}, {type:"COMPUTER_FIRE", cell:target});
    computerShots++;
    if (s.playerBoard.shots.length === before) wastedComputerShots++;
  }
  const playerHits = s.playerBoard.ships.reduce((a,sh)=>a+sh.hits.length,0);
  return {winner: s.winner, phase: s.phase, computerShots, wastedComputerShots, undefinedTargets,
          distinct: s.playerBoard.shots.length, playerFleetHits: playerHits,
          playerSunk: s.playerBoard.ships.filter(sh=>sh.hits.length===sh.size).length};
}

function run(G, label) {
  const N = Number(process.env.N || 2000);
  let agg = {computerShots:0, wasted:0, distinct:0, sunk:0, undef:0, winsComputer:0, winsPlayer:0, unfinished:0};
  for (let i=0;i<N;i++){
    const r = playGame(G, i);
    agg.computerShots += r.computerShots;
    agg.wasted += r.wastedComputerShots;
    agg.distinct += r.distinct;
    agg.sunk += r.playerSunk;
    agg.undef += r.undefinedTargets;
    if (r.winner==="computer") agg.winsComputer++;
    else if (r.winner==="player") agg.winsPlayer++;
    else agg.unfinished++;
  }
  console.log(`\n### ${label} (${N} games, player sweeps A1->J10)`);
  console.log(`computer shots fired          : ${(agg.computerShots/N).toFixed(1)} per game`);
  console.log(`  of which wasted (duplicate) : ${(agg.wasted/N).toFixed(1)} per game  = ${(100*agg.wasted/agg.computerShots).toFixed(1)}%`);
  console.log(`  target === undefined        : ${(agg.undef/N).toFixed(2)} per game`);
  console.log(`distinct cells the computer actually shot at: ${(agg.distinct/N).toFixed(1)}/100`);
  console.log(`player ships sunk by computer : ${(agg.sunk/N).toFixed(2)}/5 per game`);
  console.log(`outcomes: computer wins ${agg.winsComputer}, player wins ${agg.winsPlayer}, no winner ${agg.unfinished}`);
}

run(OLD, "BEFORE fix (2f3c561: chooseComputerShot reads computerBoard.shots)");
run(NEW, "AFTER fix (4f73ea1: chooseComputerShot reads playerBoard.shots)");
