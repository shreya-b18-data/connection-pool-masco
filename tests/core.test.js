/* Run with:  node --test tests/ */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
['prng', 'graph', 'similarity', 'metrics', 'algorithms/standard', 'algorithms/backtracking', 'algorithms/knapsack',
 'algorithms/tsp', 'algorithms/maxflow', 'masco', 'evaluate'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
const CPM = globalThis.CPM;

function tinyGraph() {
  // Hand-built: a - b - c, plus d isolated; vectors chosen so similarities are easy to reason about.
  const mk = (id, cluster, v, conns) => ({ id, name: id, cluster, interestVector: v, connections: conns });
  return CPM.prepare({ users: {
    a: mk('a', 0, [1, 0, 0], ['b']), b: mk('b', 0, [1, 0, 0], ['a', 'c']),
    c: mk('c', 0, [0.9, 0.1, 0], ['b']), d: mk('d', 1, [0, 0, 1], []),
  }, edges: [['a', 'b'], ['b', 'c']], communities: 2, seed: 0 });
}

test('seeded graph generation is reproducible', () => {
  const g1 = CPM.generateGraph({ n: 40, seed: 5 }), g2 = CPM.generateGraph({ n: 40, seed: 5 });
  assert.deepStrictEqual(g1.edges, g2.edges);
  assert.notDeepStrictEqual(g1.edges, CPM.generateGraph({ n: 40, seed: 6 }).edges);
});

test('connections are symmetric', () => {
  const g = CPM.generateGraph({ n: 40, seed: 1 });
  g.keys.forEach((a) => g.users[a].connections.forEach((b) => assert.ok(g.connSet[b].has(a))));
});

test('held-out edges are absent from the training graph', () => {
  const g = CPM.generateGraph({ n: 60, seed: 3 });
  const { train, heldOut } = CPM.splitEdges(g, 0.25, 9);
  Object.entries(heldOut).forEach(([u, set]) => set.forEach((v) => assert.ok(!train.connSet[u].has(v))));
  const hidden = Object.values(heldOut).reduce((s, x) => s + x.size, 0) / 2;
  assert.strictEqual(train.edges.length + hidden, g.edges.length);
});

test('similarity is in range and ranks the closer user higher', () => {
  const g = tinyGraph();
  const s = CPM.calculateSimilarity(g, 'a', 'c').combinedScore, t = CPM.calculateSimilarity(g, 'a', 'd').combinedScore;
  assert.ok(s > t && s >= 0 && s <= 1);
});

test('backtracking matches brute force on a small graph', () => {
  const g = CPM.generateGraph({ n: 16, seed: 11 });
  const u = g.keys[0], k = 3;
  const cands = CPM.rankCandidates(g, u);
  let best = -1;
  const rec = (i, chosen, sum, per) => {
    if (chosen === k || i === cands.length) { best = Math.max(best, sum); return; }
    const c = cands[i];
    if ((per[c.cluster] || 0) < 2) { per[c.cluster] = (per[c.cluster] || 0) + 1; rec(i + 1, chosen + 1, sum + c.score, per); per[c.cluster]--; }
    rec(i + 1, chosen, sum, per);
  };
  rec(0, 0, 0, {});
  const got = CPM.algorithms.backtracking(g, u, k).stats.bestScore;
  assert.ok(Math.abs(got - best) < 1e-9);
});

test('knapsack matches brute force on a small graph', () => {
  const g = CPM.generateGraph({ n: 12, seed: 2 });
  const u = g.keys[0], capacity = 5;
  const me = g.users[u];
  const items = CPM.rankCandidates(g, u).map((c) => ({ p: c.score * 100,
    w: 1 + (g.users[c.userKey].connections.length > g.avgDegree ? 1 : 0) + (c.cluster !== me.cluster ? 1 : 0) }));
  let best = 0;
  for (let mask = 0; mask < 1 << items.length; mask++) {
    let p = 0, w = 0;
    items.forEach((it, i) => { if (mask & (1 << i)) { p += it.p; w += it.w; } });
    if (w <= capacity) best = Math.max(best, p);
  }
  const got = CPM.algorithms.knapsack(g, u, 3, capacity).stats.maxProfit;
  assert.ok(Math.abs(got - best) < 1e-6);
});

test('max flow equals the known value on a hand-made network', () => {
  // s - x - t with capacities limited by similarity-derived weights: flow to t cannot exceed the weaker edge.
  const g = tinyGraph();
  const r = CPM.algorithms.maxflow(g, 'a', 5);
  const toC = r.items.find((i) => i.userKey === 'c');
  const cap = (x, y) => Math.round(CPM.calculateSimilarity(g, x, y).combinedScore * 100);
  assert.strictEqual(toC.score, Math.min(cap('a', 'b'), cap('b', 'c')));
});

test('every algorithm returns k unique non-neighbours', () => {
  const g = CPM.generateGraph({ n: 60, seed: 4 });
  const u = g.keys.find((x) => g.users[x].connections.length > 1);
  CPM.ALGORITHM_NAMES.forEach((name) => {
    const { items } = CPM.algorithms[name](g, u, 5);
    const ids = items.map((i) => i.userKey);
    assert.strictEqual(new Set(ids).size, ids.length, name);
    ids.forEach((id) => { assert.notStrictEqual(id, u); assert.ok(!g.connSet[u].has(id), name); });
  });
});

test('consensus formula and ordering', () => {
  const lists = [[{ userKey: 'x', score: 1 }, { userKey: 'y', score: 0.5 }], [{ userKey: 'x', score: 2 }]];
  const out = CPM.consensus(lists, 2, 0.4, 0.6);
  assert.strictEqual(out[0].userKey, 'x');
  assert.ok(Math.abs(out[0].score - (0.4 * 1 + 0.6 * 1)) < 1e-9);
  assert.ok(Math.abs(out[1].score - (0.4 * 0.5 + 0.6 * 0.5)) < 1e-9);
});

test('latency-budget selection keeps the fastest and respects the budget', () => {
  const chosen = CPM.selectAlgorithms({ a: 5, b: 1, c: 2 }, 3.5);
  assert.deepStrictEqual(chosen, ['b', 'c']);
  assert.deepStrictEqual(CPM.selectAlgorithms({ a: 5, b: 1 }, 0.1), ['b']);
});

test('metrics behave on simple cases', () => {
  const rel = new Set(['a', 'b']);
  assert.strictEqual(CPM.metrics.precisionAtK(['a', 'x', 'y'], rel, 3), 1 / 3);
  assert.strictEqual(CPM.metrics.recallAtK(['a', 'b', 'y'], rel, 3), 1);
  assert.strictEqual(CPM.metrics.ndcgAtK(['a', 'b'], rel, 2), 1);
  assert.strictEqual(CPM.metrics.hitAtK(['x'], rel, 1), 0);
});

test('evaluation is deterministic in quality metrics', () => {
  const a = CPM.evaluate({ n: 50, seed: 8, maxUsers: 15 }), b = CPM.evaluate({ n: 50, seed: 8, maxUsers: 15 });
  CPM.ALGORITHM_NAMES.forEach((n) => assert.strictEqual(a.algorithms[n].precision, b.algorithms[n].precision));
  assert.strictEqual(a.masco.precision, b.masco.precision);
});
