# Connection Pool and MASCO

A social connection recommender built from five graph and optimisation algorithms, plus **MASCO** (Multi-Algorithm Social Connection Optimizer), a consensus ensemble that combines them. MASCO is also the evaluation framework: every result is measured by hiding real connections and checking whether each method recovers them.

Live demo: open `index.html` (works from the file system, no build step). It runs the evaluation in your browser.

## Algorithms (`js/algorithms/`)
| Algorithm | Idea |
|---|---|
| Standard | Rank non-connected users by combined similarity (0.6 interest cosine + 0.25 mutual-connection overlap + 0.15 same cluster) |
| Backtracking | Best set of k users with at most 2 per cluster; branch and bound using the best remaining scores as the upper bound |
| Knapsack (branch and bound) | Maximise total similarity under an "introduction cost" budget |
| TSP path | Lowest-cost open path through the 8 most similar candidates, oriented to start with the best match |
| Max flow | Edmonds-Karp; a candidate's score is the max flow from the user over similarity-weighted edges |

## MASCO (`js/masco.js`)
`consensus = 0.4 x (votes / number of algorithms) + 0.6 x average normalised score`. Votes count how many algorithms put a candidate in their top k, and each algorithm's scores are divided by its own best score. A latency-budget mode adds algorithms from fastest to slowest while the total mean runtime fits the budget.

## Evaluation protocol (`js/evaluate.js`)
1. Generate a seeded synthetic graph (120 users, 4 communities, 15 interest categories).
2. Hide 20% of the edges. Build the recommendation graph from the remaining edges only, so there is no leakage.
3. For every user with a hidden edge, recommend k = 5 users with each algorithm and with MASCO.
4. Report precision@k, recall@k, hit rate, NDCG@k, cluster diversity and runtime per user.

## Run
```bash
npm test                  # 12 unit tests (needs Node 18+)
npm run eval              # one graph, writes results/evaluation.json
npm run eval:multi        # 10 random graphs, writes results/multi_seed.json
```
Quality metrics are deterministic for a given seed. Runtimes depend on your machine.

## Results
Mean over 10 random graphs (seeds 1-10), k = 5, precision@5 as mean +/- standard deviation:

| Method | Precision@5 | NDCG@5 | Diversity |
|---|---|---|---|
| Standard | 0.053 +/- 0.016 | 0.105 | 0.250 |
| Backtracking | 0.022 +/- 0.011 | 0.059 | 0.771 |
| Knapsack | 0.051 +/- 0.011 | 0.108 | 0.250 |
| TSP | 0.055 +/- 0.009 | 0.110 | 0.250 |
| Max flow | 0.041 +/- 0.017 | 0.086 | 0.313 |
| MASCO | 0.053 +/- 0.015 | 0.104 | 0.260 |

**Findings**
- MASCO did not beat the best single algorithm on accuracy. It matched the strongest methods, and was within noise of them (differences are smaller than the standard deviation). It matched or beat every single algorithm on precision in 2 of 10 graphs.
- The clearest trade-off is diversity: backtracking's per-cluster limit gives much more varied lists (0.77) at the cost of accuracy.
- Max flow is 100x slower than the others (about 15 ms per user versus under 1 ms).
- On a single graph (seed 42), the budget mode (5 ms) used four algorithms and lowered runtime from about 17 ms to about 1.5 ms per user with a small drop in precision.

## Changes from the original single-file version (`legacy/`)
- Knapsack weights were random, so results changed on every run. They are now a deterministic function of popularity and cluster.
- Max flow reused one residual graph across all targets, so later targets were computed on a depleted graph. The residual is now reset for every target.
- The TSP step used the first 5 candidates in storage order. It now uses the top 8 by similarity.
- The backtracking bound assumed every remaining candidate scores 1.0. It now uses the actual best remaining scores, which prunes far more.
- The original MASCO page showed fixed quality, runtime and KPI numbers. MASCO now runs the real algorithms and measures everything.

## Limitations
- The data is synthetic. Users, clusters and edges come from the same community model, so absolute scores are optimistic and say little about real social networks.
- Hidden edges are about 4 per evaluated user among about 115 candidates, so precision@5 values are low for every method.
- Cluster labels are given to the algorithms. A real system would have to infer them.
- The evaluation measures recovery of hidden edges, not whether users would find the recommendations useful.
- The weights 0.4 and 0.6 were not tuned.

## Structure
```
index.html, css/, js/ui.js     browser dashboard
js/graph.js, similarity.js     synthetic graph, similarity
js/algorithms/                 five recommenders
js/masco.js                    consensus ensemble and latency-budget selection
js/metrics.js, evaluate.js     ranking metrics and held-out-edge protocol
node/                          command-line evaluation
tests/core.test.js             unit tests
legacy/                        the original single-file Connection Pool page
```
