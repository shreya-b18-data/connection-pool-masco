/* Synthetic social graph: users with interest vectors, community structure and symmetric connections. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  const N_CATEGORIES = 15;

  /** Build the Set-based adjacency used by similarity and the algorithms. Call after changing connections. */
  CPM.prepare = function (graph) {
    graph.keys = Object.keys(graph.users);
    graph.connSet = {};
    let total = 0;
    graph.keys.forEach((k) => {
      graph.connSet[k] = new Set(graph.users[k].connections);
      total += graph.users[k].connections.length;
    });
    graph.avgDegree = total / Math.max(1, graph.keys.length);
    return graph;
  };

  /**
   * generateGraph({ n, communities, pIn, pOut, seed })
   * Each community favours 3 interest categories; users get noisy vectors around that profile.
   * Edges appear with probability pIn inside a community and pOut across communities.
   */
  CPM.generateGraph = function ({ n = 120, communities = 4, pIn = 0.15, pOut = 0.01, seed = 42 } = {}) {
    const rng = CPM.makeRng(seed);
    const users = {};
    const perCommunity = Math.ceil(n / communities);
    for (let i = 0; i < n; i++) {
      const c = Math.min(communities - 1, Math.floor(i / perCommunity));
      const vec = Array(N_CATEGORIES).fill(0);
      for (let j = 0; j < N_CATEGORIES; j++) vec[j] = rng() * 0.15;
      for (let h = 0; h < 3; h++) vec[(c * 3 + h) % N_CATEGORIES] += 0.5 + rng();
      const sum = vec.reduce((s, v) => s + v, 0);
      users['u' + i] = { id: 'u' + i, name: 'User ' + i, cluster: c, interestVector: vec.map((v) => v / sum), connections: [] };
    }
    const keys = Object.keys(users);
    const edges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const same = users[keys[i]].cluster === users[keys[j]].cluster;
        if (rng() < (same ? pIn : pOut)) edges.push([keys[i], keys[j]]);
      }
    }
    edges.forEach(([a, b]) => { users[a].connections.push(b); users[b].connections.push(a); });
    return CPM.prepare({ users, edges, communities, seed });
  };

  /**
   * splitEdges(graph, fraction, seed): hide a random fraction of edges as the test set.
   * Returns { train, heldOut } where train has no trace of the hidden edges and heldOut[u] is a Set of hidden neighbours.
   */
  CPM.splitEdges = function (graph, fraction = 0.2, seed = 7) {
    const rng = CPM.makeRng(seed);
    const shuffled = CPM.shuffle(graph.edges, rng);
    const nTest = Math.round(shuffled.length * fraction);
    const test = shuffled.slice(0, nTest);
    const keep = shuffled.slice(nTest);
    const users = {};
    graph.keys.forEach((k) => {
      const u = graph.users[k];
      users[k] = { id: u.id, name: u.name, cluster: u.cluster, interestVector: u.interestVector, connections: [] };
    });
    keep.forEach(([a, b]) => { users[a].connections.push(b); users[b].connections.push(a); });
    const heldOut = {};
    test.forEach(([a, b]) => {
      (heldOut[a] = heldOut[a] || new Set()).add(b);
      (heldOut[b] = heldOut[b] || new Set()).add(a);
    });
    return { train: CPM.prepare({ users, edges: keep, communities: graph.communities, seed: graph.seed }), heldOut };
  };
})();
