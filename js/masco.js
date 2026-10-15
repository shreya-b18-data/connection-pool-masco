/* MASCO: Multi-Algorithm Social Connection Optimizer.
   Runs several recommenders, then ranks candidates by consensus:
     consensus = wVotes x (votes / numAlgorithms) + wScore x averageNormalisedScore
   votes = how many algorithms put the candidate in their top-k; each algorithm's scores are divided by its own best score so they are comparable. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.ALGORITHM_NAMES = ['standard', 'backtracking', 'knapsack', 'tsp', 'maxflow'];

  CPM.consensus = function (lists, k = 5, wVotes = 0.4, wScore = 0.6) {
    const nAlgs = lists.length;
    const table = {};
    lists.forEach((items) => {
      const top = items.reduce((m, it) => Math.max(m, it.score), 0) || 1;
      items.forEach((it) => {
        const e = (table[it.userKey] = table[it.userKey] || { userKey: it.userKey, votes: 0, scoreSum: 0 });
        e.votes++; e.scoreSum += it.score / top;
      });
    });
    const out = Object.values(table).map((e) => ({
      userKey: e.userKey, votes: e.votes, avgScore: e.scoreSum / e.votes,
      score: wVotes * (e.votes / nAlgs) + wScore * (e.scoreSum / e.votes),
    }));
    out.sort((a, b) => b.score - a.score || b.votes - a.votes || (a.userKey < b.userKey ? -1 : 1));
    return out.slice(0, k);
  };

  /** Latency-budget mode: add algorithms from fastest to slowest while the summed mean runtime stays within the budget (always keeps the fastest). */
  CPM.selectAlgorithms = function (meanMs, budgetMs) {
    const order = Object.keys(meanMs).sort((a, b) => meanMs[a] - meanMs[b]);
    const chosen = [];
    let total = 0;
    order.forEach((name) => {
      if (chosen.length === 0 || total + meanMs[name] <= budgetMs) { chosen.push(name); total += meanMs[name]; }
    });
    return chosen;
  };

  /** Run MASCO for one user. Returns the consensus list, per-algorithm lists and timings (ms). */
  CPM.runMasco = function (graph, userKey, { k = 5, algorithms = CPM.ALGORITHM_NAMES, wVotes = 0.4, wScore = 0.6 } = {}) {
    const perAlgorithm = {}, timing = {};
    algorithms.forEach((name) => {
      const t0 = performance.now();
      perAlgorithm[name] = CPM.algorithms[name](graph, userKey, k);
      timing[name] = performance.now() - t0;
    });
    const t1 = performance.now();
    const items = CPM.consensus(algorithms.map((n) => perAlgorithm[n].items), k, wVotes, wScore);
    timing.consensus = performance.now() - t1;
    return { items, perAlgorithm, timing };
  };
})();
