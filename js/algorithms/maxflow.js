/* Max flow (Edmonds-Karp): edge capacity = round(similarity x 100). A candidate's score is the maximum flow from the user to it,
   so well-connected, similar neighbourhoods carry more flow.
   Fix vs. the original: the residual graph is reset for every sink (the original reused one residual graph across sinks). */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.algorithms = CPM.algorithms || {};
  CPM.algorithms.maxflow = function (graph, userKey, k = 5) {
    const keys = graph.keys, n = keys.length;
    const idx = {}; keys.forEach((key, i) => { idx[key] = i; });
    const base = new Float64Array(n * n);
    const adj = keys.map(() => []);
    keys.forEach((a) => {
      graph.users[a].connections.forEach((b) => {
        base[idx[a] * n + idx[b]] = Math.round(CPM.calculateSimilarity(graph, a, b).combinedScore * 100);
        adj[idx[a]].push(idx[b]);
      });
    });
    const s = idx[userKey];
    const parent = new Int32Array(n);
    let augmentations = 0;

    function bfs(res, sink) {
      parent.fill(-1); parent[s] = s;
      const q = [s];
      for (let h = 0; h < q.length; h++) {
        const u = q[h];
        for (const v of adj[u]) {
          if (parent[v] === -1 && res[u * n + v] > 0) { parent[v] = u; if (v === sink) return true; q.push(v); }
        }
      }
      return false;
    }

    const results = [];
    for (let t = 0; t < n; t++) {
      if (t === s || graph.connSet[userKey].has(keys[t])) continue;
      const res = Float64Array.from(base);       // fresh residual for each sink
      let flow = 0, iter = 0;
      while (iter < 100 && bfs(res, t)) {
        iter++; augmentations++;
        let f = Infinity;
        for (let v = t; v !== s; v = parent[v]) f = Math.min(f, res[parent[v] * n + v]);
        for (let v = t; v !== s; v = parent[v]) { res[parent[v] * n + v] -= f; res[v * n + parent[v]] += f; }
        flow += f;
      }
      if (flow > 0) results.push({ userKey: keys[t], score: flow });
    }
    results.sort((a, b) => b.score - a.score || (a.userKey < b.userKey ? -1 : 1));
    return { items: results.slice(0, k), stats: { augmentations, reachableCandidates: results.length } };
  };
})();
