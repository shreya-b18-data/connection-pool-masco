/* Backtracking: choose the best SET of k users, with at most maxPerCluster from any one cluster (diversity constraint).
   Upper bound: current score + the best `remaining` scores still available (valid because candidates are sorted by score). */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.algorithms = CPM.algorithms || {};
  CPM.algorithms.backtracking = function (graph, userKey, k = 5, maxPerCluster = 2) {
    const cands = CPM.rankCandidates(graph, userKey);
    const n = cands.length;
    // suffixBest[i][r] would be large; a prefix-sum array lets us sum the next r scores in O(1).
    const prefix = [0];
    cands.forEach((c) => prefix.push(prefix[prefix.length - 1] + c.score));
    let best = [], bestScore = -1, states = 0;
    const perCluster = {};
    const chosen = [];

    function go(i, score) {
      states++;
      if (chosen.length === k || i === n) {
        if (score > bestScore) { bestScore = score; best = chosen.slice(); }
        return;
      }
      const remaining = k - chosen.length;
      const bound = score + (prefix[Math.min(n, i + remaining)] - prefix[i]);
      if (bound <= bestScore) return;
      const c = cands[i];
      if ((perCluster[c.cluster] || 0) < maxPerCluster) {
        perCluster[c.cluster] = (perCluster[c.cluster] || 0) + 1;
        chosen.push(c);
        go(i + 1, score + c.score);
        chosen.pop();
        perCluster[c.cluster]--;
      }
      go(i + 1, score);
    }
    go(0, 0);
    best.sort((x, y) => y.score - x.score || (x.userKey < y.userKey ? -1 : 1));
    return { items: best.map(({ userKey: u, score }) => ({ userKey: u, score })), stats: { statesExplored: states, bestScore } };
  };
})();
