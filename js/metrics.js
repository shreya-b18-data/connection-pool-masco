/* Ranking metrics on held-out edges (binary relevance). */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.metrics = {
    precisionAtK(recs, relevant, k) { return recs.slice(0, k).filter((r) => relevant.has(r)).length / k; },
    recallAtK(recs, relevant, k) { return recs.slice(0, k).filter((r) => relevant.has(r)).length / relevant.size; },
    hitAtK(recs, relevant, k) { return recs.slice(0, k).some((r) => relevant.has(r)) ? 1 : 0; },
    ndcgAtK(recs, relevant, k) {
      let dcg = 0;
      recs.slice(0, k).forEach((r, i) => { if (relevant.has(r)) dcg += 1 / Math.log2(i + 2); });
      let ideal = 0;
      for (let i = 0; i < Math.min(k, relevant.size); i++) ideal += 1 / Math.log2(i + 2);
      return ideal === 0 ? 0 : dcg / ideal;
    },
    /** Share of distinct clusters in the list, relative to the most that could appear. */
    clusterDiversity(recs, clusterOf, k, nClusters) {
      const list = recs.slice(0, k);
      return new Set(list.map(clusterOf)).size / Math.min(k, nClusters, Math.max(1, list.length));
    },
  };
})();
