/* Similarity between two users: interest cosine + mutual-connection overlap + same-cluster bonus. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});

  CPM.cosine = function (a, b) {
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i]; }
    return ma === 0 || mb === 0 ? 0 : dot / Math.sqrt(ma * mb);
  };

  /** Same weights as the original project: 0.6 interest + 0.25 mutual (Jaccard) + 0.15 same cluster. */
  CPM.calculateSimilarity = function (graph, aKey, bKey) {
    const a = graph.users[aKey], b = graph.users[bKey];
    const interestSimilarity = CPM.cosine(a.interestVector, b.interestVector);
    const sa = graph.connSet[aKey], sb = graph.connSet[bKey];
    let mutual = 0;
    sa.forEach((x) => { if (sb.has(x)) mutual++; });
    const union = sa.size + sb.size - mutual;
    const mutualFactor = union > 0 ? mutual / union : 0;
    const clusterBonus = a.cluster === b.cluster ? 0.15 : 0;
    return { interestSimilarity, mutualConnections: mutual, mutualFactor, clusterBonus,
             combinedScore: 0.6 * interestSimilarity + 0.25 * mutualFactor + clusterBonus };
  };

  /** Everyone the user is not yet connected to, with their similarity, sorted best first (ties by key). */
  CPM.rankCandidates = function (graph, userKey) {
    const out = [];
    graph.keys.forEach((k) => {
      if (k !== userKey && !graph.connSet[userKey].has(k)) {
        out.push({ userKey: k, cluster: graph.users[k].cluster, score: CPM.calculateSimilarity(graph, userKey, k).combinedScore });
      }
    });
    out.sort((x, y) => y.score - x.score || (x.userKey < y.userKey ? -1 : 1));
    return out;
  };
})();
