/* Command-line evaluation.   node node/run_eval.js [--n 120] [--seed 42] [--k 5] [--budget 5]
   Writes results/evaluation.json and prints a table. Quality metrics are deterministic for a given seed; runtimes depend on your machine. */
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', 'js');
['prng', 'graph', 'similarity', 'metrics', 'algorithms/standard', 'algorithms/backtracking', 'algorithms/knapsack',
 'algorithms/tsp', 'algorithms/maxflow', 'masco', 'evaluate'].forEach((f) => require(path.join(root, f + '.js')));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = Number(process.argv[i + 1]);
const res = globalThis.CPM.evaluate({ n: args.n, seed: args.seed, k: args.k, budgetMs: args.budget });

const row = (name, m) => `${name.padEnd(22)} ${m.precision.toFixed(3).padStart(8)} ${m.recall.toFixed(3).padStart(8)} ${m.hitRate.toFixed(3).padStart(8)} ${m.ndcg.toFixed(3).padStart(8)} ${m.diversity.toFixed(3).padStart(10)} ${m.meanMs.toFixed(2).padStart(9)}`;
console.log(`users=${res.graphInfo.users} edges=${res.graphInfo.edges} evaluated=${res.graphInfo.evaluatedUsers} k=${res.config.k} seed=${res.config.seed}`);
console.log('algorithm'.padEnd(22) + ' P@k'.padStart(9) + ' R@k'.padStart(9) + ' Hit@k'.padStart(9) + ' NDCG@k'.padStart(9) + ' Diversity'.padStart(11) + ' ms/user'.padStart(10));
Object.entries(res.algorithms).forEach(([n, m]) => console.log(row(n, m)));
console.log(row('MASCO (all 5)', res.masco));
if (res.mascoBudget) console.log(row(`MASCO (${res.mascoBudget.algorithms.join('+')})`, res.mascoBudget));
console.log(`best single: ${res.bestSingle}; MASCO precision change vs best single: ${res.improvementPct == null ? 'n/a' : res.improvementPct.toFixed(1) + '%'}`);

const out = path.join(__dirname, '..', 'results', 'evaluation.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 2));
console.log('saved', out);
