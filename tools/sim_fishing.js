// Simulates portable fishing with the real rules (tools/sim_fishing.js): compiles src/fishing/engine.ts on the fly.
const ts = require('typescript'); const fs = require('fs'); const path = require('path'); const Module = require('module');
const src = fs.readFileSync(path.join(__dirname, '../src/fishing/engine.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const m = new Module(path.join(__dirname, '../src/fishing/engine.js')); m.filename = m.id; m.paths = Module._nodeModulePaths(path.dirname(m.id));
m._compile(js, m.filename); const E = m.exports;
// a player taps right 80% of the time, answering in time 90% of the time
function fight(p) { let st = 100, t = 0; while (t < p.seconds) { t += p.every; if (Math.random() < ACC) st -= p.hit; else st += p.heal; st = Math.min(100, st + p.pull * p.every); if (st <= 0) return true; } return false; }
const ACC = Number(process.env.ACC || 0.75);
const willow = E.RODS['17391'], composite = E.RODS[Object.keys(E.RODS).find(k => E.RODS[k].name.startsWith('Composite'))];
const zoneOf = (name) => E.ZONES.find(z => z.name === name);
for (const [label, zoneName, baitId, startSkill, rod] of [
  ['beginner, Windurst Woods, Little Worm', 'Windurst Woods', 17396, 0, willow],
  ['mid, Sea Serpent Grotto, Sardine paste', 'Sea Serpent Grotto', 16996, 300, willow],
  ['high, Bibiki Bay, Minnow, composite', 'Bibiki Bay', 17407, 700, composite]]) {
  const z = zoneOf(zoneName); const spot = z.spots[0]; const bait = E.BAIT[String(baitId)];
  let skill = startSkill, casts = 0, bites = 0, caught = 0, lost = 0, fought = 0; const seen = {};
  for (let i = 0; i < 300; i++) {
    casts++; const { fish, critical } = E.rollHook(spot, bait, Math.floor(skill / 10), rod); if (!fish) continue; bites++;
    const won = fight(E.fightParams(fish, rod, Math.floor(skill / 10), critical)); fought++;
    if (!won) { lost++; continue; }
    const [lc] = E.loseChance(fish, Math.floor(skill / 10), rod); if (Math.random() * 100 < lc) { lost++; continue; }
    caught++; seen[fish.name] = (seen[fish.name] || 0) + 1;
    skill += E.skillUp(fish.skill, skill, 9, z.city);
  }
  console.log(label, { casts, bites, caught, lost, skill: (startSkill / 10) + ' -> ' + (skill / 10) }, Object.entries(seen).slice(0, 8));
}
