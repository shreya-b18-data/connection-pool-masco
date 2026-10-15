/* 0/1 knapsack with branch and bound.
   profit = similarity x 100.  weight = "introduction cost" (deterministic, 1-3):
   1 baseline, +1 if the candidate is more connected than average (popular users are harder to reach), +1 if in another cluster.
   The original project used a random weight, which made results change on every run. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.algorithms = CPM.algorithms || {};
  CPM.algorithms.knapsack = function (graph, userKey, k = 5, capacity = null, nodeLimit = 200000) {
    capacity = capacity == null ? 2 * k : capacity;
    const me = graph.users[userKey];
    const items = CPM.rankCandidates(graph, userKey).map((c) => {
      const w = 1 + (graph.users[c.userKey].connections.length > graph.avgDegree ? 1 : 0) + (c.cluster !== me.cluster ? 1 : 0);
      return { userKey: c.userKey, score: c.score, profit: c.score * 100, weight: w };
    });
    items.sort((a, b) => b.profit / b.weight - a.profit / a.weight || (a.userKey < b.userKey ? -1 : 1));

    let maxProfit = 0, bestSel = [], nodes = 0, truncated = false;
    function bound(level, profit, weight) {
      if (weight > capacity) return 0;
      let b = profit, w = weight, j = level;
      while (j < items.length && w + items[j].weight <= capacity) { w += items[j].weight; b += items[j].profit; j++; }
      if (j < items.length) b += ((capacity - w) * items[j].profit) / items[j].weight;
      return b;
    }
    function go(level, profit, weight, sel) {
      if (++nodes > nodeLimit) { truncated = true; return; }
      if (profit > maxProfit) { maxProfit = profit; bestSel = sel.slice(); }
      if (level === items.length) return;
      const it = items[level];
      if (weight + it.weight <= capacity) {
        sel.push(it);
        go(level + 1, profit + it.profit, weight + it.weight, sel);
        sel.pop();
      }
      if (bound(level + 1, profit, weight) > maxProfit) go(level + 1, profit, weight, sel);
    }
    go(0, 0, 0, []);
    bestSel.sort((a, b) => b.profit - a.profit || (a.userKey < b.userKey ? -1 : 1));
    return { items: bestSel.slice(0, k).map(({ userKey: u, score }) => ({ userKey: u, score })),
             stats: { nodesExplored: nodes, maxProfit, capacity, itemsSelected: bestSel.length, truncated } };
  };
})();
