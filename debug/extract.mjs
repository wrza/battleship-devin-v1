// Extracts the pure game logic (SHIPS .. reducer) out of a revision of
// index.html into an ES module so it can be executed under Node.
// Usage: node debug/extract.mjs <index.html> <out.mjs>
import { readFileSync, writeFileSync } from "node:fs";
const [, , src, out] = process.argv;
const html = readFileSync(src, "utf8");
const js = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
const core = js.slice(js.indexOf("const SHIPS"), js.indexOf("const isHit"));
const names = ["SHIPS","keyFor","cellsFor","inBounds","makeBoard","makeShip","canPlace","emptyGameState","change","addMessage","placeShip","randomPlacement","chooseComputerShot","markShot","allSunk","fireAt","reducer"];
writeFileSync(out, `${core}\nexport {${names.join(",")}};\n`);
