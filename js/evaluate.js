/* Held-out edge evaluation of every algorithm and of MASCO.
   Protocol: hide a fraction of edges, recommend from the remaining graph, and check whether the hidden neighbours are recommended. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  const M = () => CPM.metrics;

  function emptyAcc() { return { precision: 0, recall: 0, hit: 0, ndcg: 0, diversity: 0, ms: 0, n: 0 }; }
  function add(acc, recs, relevant, k, graph, ms) {
    const ids = recs.map((r) => r.userKey);
    acc.precision += M().precisionAtK(ids, relevant, k);
    acc.recall += M().recallAtK(ids, relevant, k);
    acc.hit += M().hitAtK(ids, relevant, k);
    acc.ndcg += M().ndcgAtK(ids, relevant, k);
    acc.diversity += M().clusterDiversity(ids, (u) => graph.users[u].cluster, k, graph.communities);
    acc.ms += ms; acc.n++;
  }
  function finish(acc) {
    const n = acc.n || 1;
    return { precision: acc.precision / n, recall: acc.recall / n, hitRate: acc.hit / n, ndcg: acc.ndcg / n,
             diversity: acc.diversity / n, meanMs: acc.ms / n, users: acc.n };
  }

  /**
   * evaluate({ n, seed, k, testFraction, budgetMs, maxUsers })
   * Returns { config, algorithms: {name: metrics}, masco, mascoBudget, bestSingle, improvementPct, graphInfo }.
   */
  CPM.evaluate = function (opts = {}) {
    const { n = 120, seed = 42, k = 5, testFraction = 0.2, budgetMs = null, maxUsers = Infinity, wVotes = 0.4, wScore = 0.6 } = opts;
    const full = CPM.generateGraph({ n, seed });
    const { train, heldOut } = CPM.splitEdges(full, testFraction, seed + 1);
    const users = train.keys.filter((u) => heldOut[u] && heldOut[u].size > 0).slice(0, maxUsers);
    const names = CPM.ALGORITHM_NAMES;

    // Calibration on the first users gives mean runtimes for the latency-budget mode.
    const calib = users.slice(0, Math.min(10, users.length));
    const calibMs = {};
    names.forEach((a) => {
      const t0 = performance.now();
      calib.forEach((u) => CPM.algorithms[a](train, u, k));
      calibMs[a] = (performance.now() - t0) / Math.max(1, calib.length);
    });
    const budgetSet = budgetMs == null ? null : CPM.selectAlgorithms(calibMs, budgetMs);

    const acc = {}; names.forEach((a) => { acc[a] = emptyAcc(); });
    const mAll = emptyAcc(), mBudget = emptyAcc();

    users.forEach((u) => {
      const relevant = heldOut[u];
      const run = CPM.runMasco(train, u, { k, algorithms: names, wVotes, wScore });
      let sum = 0;
      names.forEach((a) => { add(acc[a], run.perAlgorithm[a].items, relevant, k, train, run.timing[a]); sum += run.timing[a]; });
      add(mAll, run.items, relevant, k, train, sum + run.timing.consensus);
      if (budgetSet) {
        const lists = budgetSet.map((a) => run.perAlgorithm[a].items);
        const t0 = performance.now();
        const items = CPM.consensus(lists, k, wVotes, wScore);
        const ms = budgetSet.reduce((s, a) => s + run.timing[a], 0) + (performance.now() - t0);
        add(mBudget, items, relevant, k, train, ms);
      }
    });

    const algorithms = {}; names.forEach((a) => { algorithms[a] = finish(acc[a]); });
    const masco = finish(mAll);
    const bestSingle = names.reduce((b, a) => (algorithms[a].precision > algorithms[b].precision ? a : b), names[0]);
    const improvementPct = algorithms[bestSingle].precision > 0
      ? ((masco.precision - algorithms[bestSingle].precision) / algorithms[bestSingle].precision) * 100 : null;
    return {
      config: { n, seed, k, testFraction, budgetMs, wVotes, wScore },
      graphInfo: { users: full.keys.length, edges: full.edges.length, heldOutEdges: Math.round(full.edges.length * testFraction),
                   evaluatedUsers: users.length },
      algorithms, masco,
      mascoBudget: budgetSet ? { algorithms: budgetSet, ...finish(mBudget) } : null,
      bestSingle, improvementPct, calibrationMs: calibMs,
    };
  };
})();
