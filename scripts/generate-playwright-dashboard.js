const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const PLAYWRIGHT_DIR = path.join(REPORT_DIR, "playwright");
const DASHBOARD_DIR = path.join(REPORT_DIR, "dashboard");
const HISTORY_DIR = path.join(REPORT_DIR, "history");
const RESULTS_PATH = path.join(PLAYWRIGHT_DIR, "results.json");
const CACHE_DIR = path.join(REPORT_DIR, ".playwright-history");
const CACHE_FILE = path.join(CACHE_DIR, "history.json");
const OUTPUT_HISTORY_FILE = path.join(HISTORY_DIR, "history.json");
const OUTPUT_HTML_FILE = path.join(DASHBOARD_DIR, "index.html");
const MAX_RUNS = 50;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function flattenSpecs(suites, bucket = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) bucket.push(spec);
    flattenSpecs(suite.suites || [], bucket);
  }
  return bucket;
}

function getLastResult(test) {
  if (!test.results || !test.results.length) return null;
  return test.results[test.results.length - 1];
}

function formatDate(dateLike) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(dateLike));
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function toRate(passed, failed) {
  const base = passed + failed;
  if (!base) return 0;
  return Number(((passed / base) * 100).toFixed(2));
}

function summarizeReport(report) {
  const specs = flattenSpecs(report.suites || []);
  const tests = specs.flatMap((spec) => spec.tests || []);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    const lastResult = getLastResult(test);
    const status = lastResult?.status;

    if (status === "passed") passed += 1;
    else if (status === "skipped") skipped += 1;
    else failed += 1;
  }

  const total = tests.length;
  const successRate = toRate(passed, failed);
  const startedAt = report?.stats?.startTime || new Date().toISOString();
  const duration = report?.stats?.duration || 0;

  return {
    runId: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    branch: process.env.GITHUB_REF_NAME || "local",
    status: failed > 0 ? "failed" : "passed",
    startedAt,
    finishedAt: new Date(new Date(startedAt).getTime() + duration).toISOString(),
    duration,
    total,
    passed,
    failed,
    skipped,
    successRate,
  };
}

function buildDashboard(history) {
  const latest = history[0];
  const totalRuns = history.length;
  const avgSuccess = totalRuns
    ? Number((history.reduce((sum, run) => sum + run.successRate, 0) / totalRuns).toFixed(2))
    : 0;
  const avgDuration = totalRuns
    ? Math.round(history.reduce((sum, run) => sum + run.duration, 0) / totalRuns)
    : 0;

  const labels = history
    .slice()
    .reverse()
    .map((run, index) => `Execução ${index + 1}`);
  const durations = history.slice().reverse().map((run) => run.duration);
  const successRates = history.slice().reverse().map((run) => run.successRate);
  const executionDates = history.slice().reverse().map((run) => formatDate(run.startedAt));

  const rows = history
    .map((run, index) => {
      return `
        <tr>
          <td>${history.length - index}</td>
          <td>${escapeHtml(formatDate(run.startedAt))}</td>
          <td>${run.total}</td>
          <td class="success">${run.passed}</td>
          <td class="danger">${run.failed}</td>
          <td>${run.successRate}%</td>
          <td>${escapeHtml(formatDuration(run.duration))}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard Histórico de Testes</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg: #120f1f;
      --bg-accent-1: rgba(124, 58, 237, 0.20);
      --bg-accent-2: rgba(168, 85, 247, 0.12);
      --panel: #1c1730;
      --panel-2: #241d3e;
      --border: #34285a;
      --text: #f5f7ff;
      --muted: #b8b4d6;
      --primary: #7c3aed;
      --success: #22c55e;
      --danger: #ef4444;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      --badge-bg: rgba(255, 255, 255, 0.04);
      --header-bg: linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(28, 23, 48, 0.96));
      --thead-bg: rgba(124, 58, 237, 0.32);
      --hover-bg: rgba(168, 85, 247, 0.12);
      --table-divider: rgba(255, 255, 255, 0.12);
      --table-row-bg: rgba(255, 255, 255, 0.02);
      --table-header-text: #f3e8ff;
      --chart-grid: rgba(255, 255, 255, 0.06);
      --chart-ticks: #b8b4d6;
      --chart-legend: #f5f7ff;
      --tooltip-bg: #1c1730;
      --tooltip-title: #ffffff;
      --tooltip-body: #ffffff;
      --toggle-bg: rgba(255, 255, 255, 0.08);
      --toggle-hover: rgba(255, 255, 255, 0.14);
    }
    body[data-theme="light"] {
      --bg: #f3efff;
      --bg-accent-1: rgba(124, 58, 237, 0.14);
      --bg-accent-2: rgba(168, 85, 247, 0.10);
      --panel: #ffffff;
      --panel-2: #ede7ff;
      --border: #beaef7;
      --text: #1e1446;
      --muted: #53428e;
      --primary: #6d28d9;
      --success: #15803d;
      --danger: #dc2626;
      --shadow: 0 12px 32px rgba(64, 36, 133, 0.14);
      --badge-bg: rgba(109, 40, 217, 0.07);
      --header-bg: linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(255, 255, 255, 0.98));
      --thead-bg: rgba(109, 40, 217, 0.18);
      --hover-bg: rgba(109, 40, 217, 0.12);
      --table-divider: rgba(30, 20, 70, 0.16);
      --table-row-bg: rgba(109, 40, 217, 0.03);
      --table-header-text: #3b1b7a;
      --chart-grid: rgba(30, 20, 70, 0.10);
      --chart-ticks: #53428e;
      --chart-legend: #1e1446;
      --tooltip-bg: #ffffff;
      --tooltip-title: #1e1446;
      --tooltip-body: #35266e;
      --toggle-bg: rgba(109, 40, 217, 0.08);
      --toggle-hover: rgba(109, 40, 217, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at top right, var(--bg-accent-1), transparent 30%),
        radial-gradient(circle at top left, var(--bg-accent-2), transparent 25%),
        var(--bg);
      color: var(--text);
    }
    h1, h2, h3 { margin-top: 0; color: var(--text); }
    .header, .card, .panel, table { box-shadow: var(--shadow); border: 1px solid var(--border); }
    .header { margin-bottom: 24px; padding: 24px; border-radius: 18px; background: var(--header-bg); }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .header p, .card-sub, .meta-label { color: var(--muted); }
    .theme-toggle { display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--toggle-bg); color: var(--text); cursor: pointer; }
    .execution-meta, .cards { display: grid; gap: 16px; }
    .execution-meta { margin-top: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .meta-badge { background: var(--badge-bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
    .meta-label { display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 14px; }
    .meta-value { font-size: 18px; font-weight: bold; }
    .cards { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px; }
    .card, .panel { background: linear-gradient(180deg, var(--panel), var(--panel-2)); padding: 18px 20px; border-radius: 16px; }
    .card-title { color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 15px; }
    .card-value { font-size: 30px; font-weight: bold; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .actions { margin-top: 14px; display: flex; gap: 12px; flex-wrap: wrap; }
    .action-link { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: rgba(124, 58, 237, 0.16); color: var(--text); border: 1px solid var(--border); text-decoration: none; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; background: linear-gradient(180deg, var(--panel), var(--panel-2)); }
    thead { background: var(--thead-bg); }
    th, td { padding: 14px 16px; border-bottom: 1px solid var(--table-divider); text-align: left; color: var(--text); }
    tbody tr { background: var(--table-row-bg); }
    tbody tr:hover { background: var(--hover-bg); }
    th { color: var(--table-header-text); text-transform: uppercase; letter-spacing: 0.04em; font-size: 14px; }
    .success { color: var(--success); font-weight: bold; }
    .danger { color: var(--danger); font-weight: bold; }
    @media (max-width: 980px) { .charts { grid-template-columns: 1fr; } body { padding: 16px; } .header-top { flex-direction: column; } }
    @media (max-width: 480px) { body { padding: 10px; } table { display: block; overflow-x: auto; white-space: nowrap; } }
  </style>
</head>
<body>
  <section class="header">
    <div class="header-top">
      <div>
        <h1>Dashboard Histórico de Testes</h1>
        <p>Acompanhamento consolidado das execuções automatizadas do Playwright.</p>
      </div>
      <button id="themeToggle" class="theme-toggle" type="button" aria-label="Alternar tema">
        <span id="themeIcon">🌙</span>
        <span id="themeLabel">Modo escuro</span>
      </button>
    </div>
    <div class="execution-meta">
      <div class="meta-badge">
        <span class="meta-label">Iniciado em</span>
        <span class="meta-value">${escapeHtml(formatDate(latest.startedAt))}</span>
      </div>
      <div class="meta-badge">
        <span class="meta-label">Data da Última Execução</span>
        <span class="meta-value">${escapeHtml(formatDate(latest.finishedAt))}</span>
      </div>
      <div class="meta-badge">
        <span class="meta-label">Tempo da Última Execução</span>
        <span class="meta-value">${escapeHtml(formatDuration(latest.duration))}</span>
      </div>
      <div class="meta-badge">
        <span class="meta-label">Quantidade de Testes Atual</span>
        <span class="meta-value">${latest.total} testes</span>
      </div>
    </div>
    <div class="actions">
      <a class="action-link" href="../playwright/html/index.html">Abrir relatório do Playwright</a>
      <a class="action-link" href="../history/history.json">Baixar histórico JSON</a>
    </div>
  </section>
  <section class="cards">
    <div class="card">
      <div class="card-title">Total de Execuções</div>
      <div class="card-value">${totalRuns}</div>
      <div class="card-sub">Quantidade acumulada de runs</div>
    </div>
    <div class="card">
      <div class="card-title">Média de Sucesso</div>
      <div class="card-value">${avgSuccess}%</div>
      <div class="card-sub">Percentual médio de testes aprovados</div>
    </div>
    <div class="card">
      <div class="card-title">Tempo Médio</div>
      <div class="card-value">${escapeHtml(formatDuration(avgDuration))}</div>
      <div class="card-sub">Duração média por execução</div>
    </div>
    <div class="card">
      <div class="card-title">Última Taxa de Sucesso</div>
      <div class="card-value">${latest.successRate}%</div>
      <div class="card-sub">Resultado da execução mais recente</div>
    </div>
  </section>
  <section class="charts">
    <div class="panel">
      <h3>Tempo por execução</h3>
      <canvas id="durationChart"></canvas>
    </div>
    <div class="panel">
      <h3>Taxa de sucesso por execução</h3>
      <canvas id="successChart"></canvas>
    </div>
  </section>
  <section>
    <h2>Histórico de Execuções</h2>
    <table>
      <thead>
        <tr>
          <th>Execução</th>
          <th>Data de Execução</th>
          <th>Total</th>
          <th>Sucesso</th>
          <th>Falha</th>
          <th>Taxa de Sucesso</th>
          <th>Tempo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  <script>
    const labels = ${JSON.stringify(labels)};
    const durations = ${JSON.stringify(durations)};
    const successRates = ${JSON.stringify(successRates)};
    const executionDates = ${JSON.stringify(executionDates)};
    const root = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');
    const savedTheme = localStorage.getItem('dashboard-theme') || 'dark';
    function getCssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
    function updateThemeButton(theme) {
      if (theme === 'light') { themeIcon.textContent = '☀️'; themeLabel.textContent = 'Modo claro'; }
      else { themeIcon.textContent = '🌙'; themeLabel.textContent = 'Modo escuro'; }
    }
    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('dashboard-theme', theme);
      updateThemeButton(theme);
    }
    function commonOptions() {
      return {
        responsive: true,
        plugins: {
          legend: { labels: { color: getCssVar('--chart-legend') } },
          tooltip: {
            backgroundColor: getCssVar('--tooltip-bg'),
            titleColor: getCssVar('--tooltip-title'),
            bodyColor: getCssVar('--tooltip-body'),
            borderColor: getCssVar('--primary'),
            borderWidth: 1,
            callbacks: { afterLabel: (context) => 'Data: ' + executionDates[context.dataIndex] }
          }
        },
        scales: {
          x: { ticks: { color: getCssVar('--chart-ticks') }, grid: { color: getCssVar('--chart-grid') } },
          y: { ticks: { color: getCssVar('--chart-ticks') }, grid: { color: getCssVar('--chart-grid') } }
        }
      };
    }
    function successOptions() {
      const options = commonOptions();
      options.scales.y = {
        ...options.scales.y,
        min: 0,
        max: 110,
        ticks: { ...options.scales.y.ticks, stepSize: 10, callback: (value) => value === 110 ? '' : value }
      };
      return options;
    }
    applyTheme(savedTheme);
    const durationChart = new Chart(document.getElementById('durationChart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Duração (ms)', data: durations, backgroundColor: 'rgba(124, 58, 237, 0.75)', borderColor: 'rgba(168, 85, 247, 1)', borderWidth: 1, borderRadius: 8 }] },
      options: commonOptions()
    });
    const successChart = new Chart(document.getElementById('successChart'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Sucesso (%)', data: successRates, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.18)', fill: true, tension: 0.3, pointBackgroundColor: '#ffffff', pointBorderColor: 'rgba(168, 85, 247, 1)', pointRadius: 4 }] },
      options: successOptions()
    });
    function refreshChartsTheme() { durationChart.options = commonOptions(); successChart.options = successOptions(); durationChart.update(); successChart.update(); }
    themeToggle.addEventListener('click', () => {
      const nextTheme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      refreshChartsTheme();
    });
  </script>
</body>
</html>`;
}

function main() {
  ensureDir(REPORT_DIR);
  ensureDir(PLAYWRIGHT_DIR);
  ensureDir(DASHBOARD_DIR);
  ensureDir(HISTORY_DIR);
  ensureDir(CACHE_DIR);

  if (!fs.existsSync(RESULTS_PATH)) {
    console.warn(`Playwright JSON report not found at ${RESULTS_PATH}. Dashboard generation skipped.`);
    return;
  }

  const report = readJsonIfExists(RESULTS_PATH, null);
  const previousHistory = readJsonIfExists(CACHE_FILE, []);
  const latestRun = summarizeReport(report);

  const dedupedHistory = [
    latestRun,
    ...previousHistory.filter((run) => run.runId !== latestRun.runId),
  ].slice(0, MAX_RUNS);

  fs.writeFileSync(CACHE_FILE, JSON.stringify(dedupedHistory, null, 2));
  fs.writeFileSync(OUTPUT_HISTORY_FILE, JSON.stringify(dedupedHistory, null, 2));
  fs.writeFileSync(OUTPUT_HTML_FILE, buildDashboard(dedupedHistory), "utf8");

  console.log(`Dashboard generated at ${OUTPUT_HTML_FILE}`);
}

main();
