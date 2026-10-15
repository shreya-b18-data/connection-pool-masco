/* Baseline: rank every non-connected user by combined similarity. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  CPM.algorithms = CPM.algorithms || {};
  CPM.algorithms.standard = function (graph, userKey, k = 5) {
    const cands = CPM.rankCandidates(graph, userKey);
    return { items: cands.slice(0, k).map(({ userKey: u, score }) => ({ userKey: u, score })),
             stats: { candidatesEvaluated: cands.length } };
  };
})();
