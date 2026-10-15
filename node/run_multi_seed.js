/* Repeat the evaluation over several random graphs to see whether differences are bigger than noise.
   node node/run_multi_seed.js [--seeds 10] [--start 1] [--k 5]
   Writes results/multi_seed.json (mean and standard deviation of precision@k, NDCG@k and diversity per method). */
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', 'js');
['prng', 'graph', 'similarity', 'metrics', 'algorithms/standard', 'algorithms/backtracking', 'algorithms/knapsack',
 'algorithms/tsp', 'algorithms/maxflow', 'masco', 'evaluate'].forEach((f) => require(path.join(root, f + '.js')));

const args = { seeds: 10, start: 1, k: 5 };
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = Number(process.argv[i + 1]);

const runs = [];
for (let s = 0; s < args.seeds; s++) runs.push(globalThis.CPM.evaluate({ seed: args.start + s, k: args.k }));
const names = [...globalThis.CPM.ALGORITHM_NAMES, 'MASCO'];
const pick = (r, n) => (n === 'MASCO' ? r.masco : r.algorithms[n]);
const stat = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { mean: m, std: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)) }; };

const out = {};
console.log(`${args.seeds} graphs (seeds ${args.start}..${args.start + args.seeds - 1}), k=${args.k}`);
console.log('method'.padEnd(14) + 'P@k mean'.padStart(10) + ' +/- std'.padStart(10) + 'NDCG mean'.padStart(11) + 'Diversity'.padStart(11));
names.forEach((n) => {
  out[n] = { precision: stat(runs.map((r) => pick(r, n).precision)), ndcg: stat(runs.map((r) => pick(r, n).ndcg)),
             diversity: stat(runs.map((r) => pick(r, n).diversity)) };
  console.log(n.padEnd(14) + out[n].precision.mean.toFixed(3).padStart(10) + out[n].precision.std.toFixed(3).padStart(10) +
              out[n].ndcg.mean.toFixed(3).padStart(11) + out[n].diversity.mean.toFixed(3).padStart(11));
});
const wins = runs.filter((r) => r.masco.precision >= Math.max(...globalThis.CPM.ALGORITHM_NAMES.map((a) => r.algorithms[a].precision))).length;
console.log(`MASCO matched or beat every single algorithm on precision in ${wins} of ${args.seeds} graphs`);
fs.writeFileSync(path.join(__dirname, '..', 'results', 'multi_seed.json'), JSON.stringify({ args, summary: out, mascoBestCount: wins }, null, 2));
console.log('saved results/multi_seed.json');
