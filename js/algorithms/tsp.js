/* TSP-style "introduction path": take the m most similar candidates, then find the open path through them with the lowest total
   distance (distance = 1 - interest similarity between the two candidates), using branch and bound.
   The path is oriented so that it starts with the candidate most similar to the user.
   Unlike the original (which used the first 5 candidates in storage order), the pool is the top-m by similarity. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.algorithms = CPM.algorithms || {};
  CPM.algorithms.tsp = function (graph, userKey, k = 5, m = 8) {
    const pool = CPM.rankCandidates(graph, userKey).slice(0, Math.max(k, m));
    const n = pool.length;
    if (n === 0) return { items: [], stats: { statesExplored: 0 } };
    const dist = pool.map((a) => pool.map((b) =>
      a === b ? 0 : 1 - CPM.cosine(graph.users[a.userKey].interestVector, graph.users[b.userKey].interestVector)));
    let minCost = Infinity, bestPath = [], states = 0;
    const visited = Array(n).fill(false), path = [];
    function go(cost) {
      states++;
      if (path.length === n) { if (cost < minCost) { minCost = cost; bestPath = path.slice(); } return; }
      for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        const c = cost + (path.length ? dist[path[path.length - 1]][i] : 0);
        if (c < minCost) { visited[i] = true; path.push(i); go(c); path.pop(); visited[i] = false; }
      }
    }
    go(0);
    if (pool[bestPath[0]].score < pool[bestPath[n - 1]].score) bestPath.reverse();
    return { items: bestPath.slice(0, k).map((i) => ({ userKey: pool[i].userKey, score: pool[i].score })),
             stats: { statesExplored: states, minPathCost: minCost, poolSize: n } };
  };
})();
