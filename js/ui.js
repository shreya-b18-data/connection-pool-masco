/* Browser UI: runs the evaluation and the single-user demo. All numbers come from CPM.evaluate / CPM.runMasco. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const LABEL = { standard: 'Standard similarity', backtracking: 'Backtracking', knapsack: 'Knapsack (B&B)', tsp: 'TSP path', maxflow: 'Max flow' };
  let chart = null, demoGraph = null;

  function readNumber(id, fallback) { const v = Number($(id).value); return Number.isFinite(v) ? v : fallback; }

  function render(res) {
    $('results').hidden = false;
    const pct = res.improvementPct;
    $('kpis').innerHTML =
      `<div class="kpi"><b>${res.masco.precision.toFixed(3)}</b><span>MASCO precision@${res.config.k}</span></div>` +
      `<div class="kpi"><b>${res.algorithms[res.bestSingle].precision.toFixed(3)}</b><span>Best single: ${esc(LABEL[res.bestSingle])}</span></div>` +
      `<div class="kpi"><b>${pct == null ? 'n/a' : (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'}</b><span>MASCO vs best single</span></div>` +
      `<div class="kpi"><b>${res.graphInfo.evaluatedUsers}</b><span>users evaluated (${res.graphInfo.edges} edges)</span></div>`;
    const row = (name, m, cls) => `<tr class="${cls || ''}"><td>${esc(name)}</td><td>${m.precision.toFixed(3)}</td><td>${m.recall.toFixed(3)}</td><td>${m.hitRate.toFixed(3)}</td><td>${m.ndcg.toFixed(3)}</td><td>${m.diversity.toFixed(3)}</td><td>${m.meanMs.toFixed(2)}</td></tr>`;
    let html = '<tr><th>Method</th><th>Precision</th><th>Recall</th><th>Hit rate</th><th>NDCG</th><th>Diversity</th><th>ms/user</th></tr>';
    Object.entries(res.algorithms).forEach(([n, m]) => { html += row(LABEL[n], m); });
    html += row('MASCO (all 5)', res.masco, 'masco');
    if (res.mascoBudget) html += row('MASCO within budget: ' + res.mascoBudget.algorithms.map((a) => LABEL[a]).join(' + '), res.mascoBudget, 'masco');
    $('table').innerHTML = html;

    if (window.Chart) {
      if (chart) chart.destroy();
      const labels = Object.keys(res.algorithms).map((n) => LABEL[n]).concat('MASCO');
      const data = Object.values(res.algorithms).map((m) => m.precision).concat(res.masco.precision);
      chart = new Chart($('chart').getContext('2d'), { type: 'bar', data: { labels, datasets: [{ label: 'Precision@k', data, backgroundColor: '#3d9a8b' }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    }
  }

  $('run').addEventListener('click', () => {
    $('run').disabled = true; $('status').textContent = 'Running: generating the graph and testing five algorithms...';
    setTimeout(() => {
      try {
        const res = CPM.evaluate({ n: readNumber('n', 120), seed: readNumber('seed', 42), k: readNumber('k', 5),
          testFraction: readNumber('frac', 20) / 100, budgetMs: readNumber('budget', 5) });
        render(res);
        $('status').textContent = `Done. Same seed gives the same quality numbers; runtimes depend on this device.`;
      } catch (e) { $('status').textContent = 'Error: ' + e.message; }
      $('run').disabled = false;
    }, 30);
  });

  function loadUsers() {
    demoGraph = CPM.generateGraph({ n: readNumber('n', 120), seed: readNumber('seed', 42) });
    $('user').innerHTML = demoGraph.keys.map((k) => `<option value="${k}">${demoGraph.users[k].name} (cluster ${demoGraph.users[k].cluster})</option>`).join('');
  }
  $('seed').addEventListener('change', loadUsers); $('n').addEventListener('change', loadUsers);
  $('rec').addEventListener('click', () => {
    const run = CPM.runMasco(demoGraph, $('user').value, { k: readNumber('k', 5) });
    $('recs').innerHTML = run.items.map((r, i) => {
      const u = demoGraph.users[r.userKey];
      return `<div class="rec"><div><b>#${i + 1} ${esc(u.name)}</b><br><small>cluster ${u.cluster}, picked by ${r.votes} of 5 algorithms</small></div><div>${r.score.toFixed(3)}<br><small>consensus</small></div></div>`;
    }).join('');
  });
  loadUsers();
})();
