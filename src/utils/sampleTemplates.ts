import type { SampleTemplate } from '../types/editor';

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    id: 'pulse-dashboard',
    name: 'Pulse Operations App',
    category: 'Web App',
    description: 'Interactive task & revenue workspace with live filtering, KPI cards, and JSON data.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pulse Operations</title>
    <meta name="description" content="Track weekly velocity, unblock engineering reviews, and coordinate launch readiness from one workspace." />
    <meta property="og:title" content="Pulse Operations Workspace" />
    <meta property="og:description" content="Interactive task & revenue workspace with live filtering and release checklists." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-group">
          <div class="brand-mark">P</div>
          <span class="brand-name">Pulse Operations</span>
        </div>
        <nav class="nav-links">
          <a href="#overview" class="nav-item active">Overview</a>
          <a href="#milestones" class="nav-item">Milestones</a>
          <a href="#reports" class="nav-item">Reports</a>
        </nav>
        <button id="primary-cta" class="primary-btn" type="button">New Milestone</button>
      </header>

      <main class="main-content">
        <section id="overview" class="hero-banner">
          <div class="hero-copy">
            <p class="hero-kicker">Q4 Delivery Workspace</p>
            <h1 class="hero-title">Ship release milestones on schedule</h1>
            <p class="hero-subtitle">Track weekly velocity, unblock engineering reviews, and coordinate launch readiness from one surface.</p>
          </div>
          <div class="hero-actions">
            <button id="export-summary-btn" class="secondary-btn" type="button">Download Summary</button>
          </div>
        </section>

        <section id="reports" class="metrics-grid">
          <article class="metric-card">
            <p class="metric-label">Monthly Recurring Revenue</p>
            <h2 class="metric-value">$84,290</h2>
            <p class="metric-delta positive">+14.2% vs prior 30 days</p>
          </article>
          <article class="metric-card">
            <p class="metric-label">Active Sprint Velocity</p>
            <h2 class="metric-value">42 pts</h2>
            <p class="metric-delta">94% commitment accuracy</p>
          </article>
          <article class="metric-card">
            <p class="metric-label">Open Customer Escalations</p>
            <h2 class="metric-value">3</h2>
            <p class="metric-delta">Median response 18 min</p>
          </article>
        </section>

        <section id="milestones" class="workspace-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Release Checklist</h2>
              <p class="panel-caption">Click items in Using Mode to toggle status or add new tasks.</p>
            </div>
            <div class="filter-tabs" role="tablist">
              <button class="filter-btn active" data-filter="all" type="button">All</button>
              <button class="filter-btn" data-filter="active" type="button">Active</button>
              <button class="filter-btn" data-filter="done" type="button">Completed</button>
            </div>
          </div>

          <form id="task-form" class="task-form">
            <input id="task-input" class="task-input" type="text" placeholder="Add release milestone..." />
            <button class="add-task-btn" type="submit">Add Item</button>
          </form>

          <ul id="task-list" class="task-list"></ul>
        </section>
      </main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #f8fafc;
  --bg-surface: #ffffff;
  --bg-subtle: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --accent-color: #2563eb;
  --border-color: #e2e8f0;
  --radius-card: 14px;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.5;
}

.app-shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 28px;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--accent-color);
  color: #ffffff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.brand-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--text-primary);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-item {
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.nav-item.active {
  color: var(--text-primary);
}

.primary-btn {
  background-color: var(--text-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:hover {
  opacity: 0.9;
}

.hero-banner {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.hero-kicker {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
  margin-bottom: 6px;
}

.hero-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.hero-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 560px;
}

.secondary-btn {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 20px;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.metric-delta {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-delta.positive {
  color: #16a34a;
  font-weight: 600;
}

.workspace-panel {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-caption {
  font-size: 13px;
  color: var(--text-secondary);
}

.filter-tabs {
  display: flex;
  gap: 6px;
  background-color: var(--bg-subtle);
  padding: 4px;
  border-radius: 8px;
}

.filter-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.filter-btn.active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.task-form {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.task-input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  outline: none;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.task-input:focus {
  border-color: var(--accent-color);
}

.add-task-btn {
  background-color: var(--accent-color);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.task-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background-color: var(--bg-page);
}

.task-left {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.task-title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.task-item.done .task-title {
  text-decoration: line-through;
  color: #94a3b8;
}

.task-owner {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .hero-banner {
    flex-direction: column;
    align-items: flex-start;
  }
  .nav-links {
    display: none;
  }
}
`,
      },
      {
        path: 'app.js',
        name: 'app.js',
        type: 'js',
        content: `let tasks = [];
let currentFilter = 'all';

const taskListEl = document.getElementById('task-list');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const primaryCta = document.getElementById('primary-cta');
const exportBtn = document.getElementById('export-summary-btn');

function renderTasks() {
  if (!taskListEl) return;
  const visible = tasks.filter((item) => {
    if (currentFilter === 'active') return !item.done;
    if (currentFilter === 'done') return item.done;
    return true;
  });

  taskListEl.innerHTML = visible
    .map(
      (task) => \`
      <li class="task-item \${task.done ? 'done' : ''}" data-id="\${task.id}">
        <label class="task-left">
          <input type="checkbox" \${task.done ? 'checked' : ''} data-toggle="\${task.id}" />
          <span class="task-title">\${task.title}</span>
        </label>
        <span class="task-owner">\${task.owner}</span>
      </li>
    \`
    )
    .join('');
}

fetch('./data.json')
  .then((res) => res.json())
  .then((data) => {
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    renderTasks();
  })
  .catch(() => {
    tasks = [
      { id: '1', title: 'Verify staging security headers', owner: 'Platform', done: true },
      { id: '2', title: 'Publish billing webhook docs', owner: 'Docs', done: false }
    ];
    renderTasks();
  });

if (taskForm) {
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = (taskInput && taskInput.value || '').trim();
    if (!title) return;
    tasks.unshift({
      id: String(Date.now()),
      title,
      owner: 'You',
      done: false
    });
    taskInput.value = '';
    renderTasks();
  });
}

if (taskListEl) {
  taskListEl.addEventListener('change', (e) => {
    const id = e.target && e.target.getAttribute('data-toggle');
    if (!id) return;
    tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    renderTasks();
  });
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-filter') || 'all';
    renderTasks();
  });
});

if (primaryCta && taskInput) {
  primaryCta.addEventListener('click', () => {
    taskInput.focus();
  });
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const completed = tasks.filter((t) => t.done).length;
    exportBtn.textContent = \`Summary Ready (\${completed}/\${tasks.length})\`;
    setTimeout(() => {
      exportBtn.textContent = 'Download Summary';
    }, 2200);
  });
}
`,
      },
      {
        path: 'data.json',
        name: 'data.json',
        type: 'json',
        content: `{
  "tasks": [
    {
      "id": "t-1",
      "title": "Audit responsive breakpoints for mobile checkout",
      "owner": "Design Systems",
      "done": true
    },
    {
      "id": "t-2",
      "title": "Connect production telemetry webhook",
      "owner": "Core API",
      "done": false
    },
    {
      "id": "t-3",
      "title": "Finalize Q4 customer onboarding checklist",
      "owner": "Solutions",
      "done": false
    }
  ]
}
`,
      },
    ],
  },
  {
    id: 'horizon-landing',
    name: 'Horizon Studio Landing',
    category: 'Landing',
    description: 'Marketing product launch layout with interactive billing switcher and pricing cards.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Horizon Studio</title>
    <meta name="description" content="A unified design token and layout engine for product teams shipping fast across every screen." />
    <meta property="og:title" content="Horizon Studio — Design Infrastructure" />
    <meta property="og:description" content="Build interfaces that scale cleanly across every screen." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-row">
        <a href="#" class="logo">Horizon</a>
        <nav class="site-nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button class="header-cta" type="button">Get Started</button>
      </div>
    </header>

    <main class="container">
      <section id="features" class="hero">
        <p class="eyebrow">Design Infrastructure</p>
        <h1 class="headline">Build interfaces that scale cleanly across every screen</h1>
        <p class="lead">A unified token and layout engine for product teams shipping fast without compromising craft.</p>
        <div class="hero-btn-row">
          <button class="btn-solid" type="button">Start Free Trial</button>
          <button class="btn-outline" type="button">View Documentation</button>
        </div>
      </section>

      <section id="pricing" class="pricing-section">
        <div class="pricing-top">
          <h2 class="section-heading">Transparent Team Pricing</h2>
          <div class="billing-switch">
            <button class="bill-btn active" data-cycle="monthly" type="button">Monthly</button>
            <button class="bill-btn" data-cycle="annual" type="button">Annual (Save 20%)</button>
          </div>
        </div>

        <div class="pricing-grid">
          <div class="plan-card">
            <h3 class="plan-name">Starter</h3>
            <p class="plan-desc">For solo builders and early prototypes.</p>
            <div class="plan-price" data-monthly="$19" data-annual="$15">$19</div>
            <p class="plan-cadence">per seat / month</p>
            <button class="plan-btn" type="button">Choose Starter</button>
          </div>

          <div class="plan-card featured">
            <h3 class="plan-name">Studio Team</h3>
            <p class="plan-desc">For product squads shipping weekly.</p>
            <div class="plan-price" data-monthly="$49" data-annual="$39">$49</div>
            <p class="plan-cadence">per seat / month</p>
            <button class="plan-btn primary" type="button">Choose Studio</button>
          </div>
        </div>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #ffffff;
  --bg-surface: #ffffff;
  --bg-subtle: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --accent-color: #2563eb;
  --border-color: #e5e7eb;
  --radius-card: 14px;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.55;
}

.container {
  max-width: 1020px;
  margin: 0 auto;
  padding: 0 24px;
}

.site-header {
  border-bottom: 1px solid var(--border-color);
  padding: 16px 0;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.site-nav {
  display: flex;
  gap: 24px;
}

.site-nav a {
  font-size: 14px;
  color: var(--text-secondary);
  text-decoration: none;
}

.header-cta {
  background-color: var(--text-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.hero {
  padding: 56px 0 44px;
  max-width: 680px;
}

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.headline {
  font-size: 40px;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.lead {
  font-size: 17px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.hero-btn-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-solid {
  background-color: var(--accent-color);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-outline {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.pricing-section {
  padding: 32px 0 64px;
  border-top: 1px solid var(--border-color);
}

.pricing-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.section-heading {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.billing-switch {
  display: inline-flex;
  background-color: var(--bg-subtle);
  padding: 4px;
  border-radius: 8px;
}

.bill-btn {
  border: none;
  background: transparent;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
}

.bill-btn.active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.plan-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 28px;
  background-color: var(--bg-surface);
}

.plan-card.featured {
  border-color: var(--accent-color);
  background-color: #f8faff;
}

.plan-name {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}

.plan-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 18px;
}

.plan-price {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
}

.plan-cadence {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.plan-btn {
  width: 100%;
  padding: 11px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}

.plan-btn.primary {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  color: #ffffff;
}

@media (max-width: 680px) {
  .pricing-grid {
    grid-template-columns: 1fr;
  }
  .headline {
    font-size: 30px;
  }
}
`,
      },
      {
        path: 'app.js',
        name: 'app.js',
        type: 'js',
        content: `const buttons = document.querySelectorAll('.bill-btn');
const prices = document.querySelectorAll('.plan-price');

buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    buttons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const cycle = btn.getAttribute('data-cycle') || 'monthly';
    prices.forEach((priceEl) => {
      const val = priceEl.getAttribute('data-' + cycle);
      if (val) priceEl.textContent = val;
    });
  });
});
`,
      },
    ],
  },
  {
    id: 'atelier-editorial',
    name: 'Atelier Monograph',
    category: 'Editorial',
    description: 'Warm newsprint editorial journal with Cormorant Garamond typography, essays index, and reading notes.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Atelier Monograph — Design & Architecture</title>
    <meta name="description" content="Essays on quiet interfaces, typographic rhythm, and architectural web systems." />
    <meta property="og:title" content="Atelier Monograph" />
    <meta property="og:description" content="Quarterly journal on craft, typography, and structural design." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="masthead">
      <div class="shell masthead-inner">
        <span class="issue-label">Issue No. 14 · Autumn</span>
        <a href="#" class="brand-serif">Atelier Monograph</a>
        <nav class="masthead-nav">
          <a href="#essays">Essays</a>
          <a href="#archive">Archive</a>
          <a href="#colophon">Colophon</a>
        </nav>
      </div>
    </header>

    <main class="shell">
      <section class="editorial-hero">
        <p class="kicker">Feature Monograph</p>
        <h1 class="display-title">Quiet Structure &amp; The Architecture of Attention</h1>
        <p class="dek">Why restrained grids, deliberate typographic scale, and tactile whitespace outlast decorative noise across digital publications.</p>
        <div class="byline-row">
          <span>By Clara Lindqvist</span>
          <span>·</span>
          <span>8 min read</span>
          <button id="bookmark-btn" class="editorial-btn" type="button">Save to Reading List</button>
        </div>
      </section>

      <section id="essays" class="essay-columns">
        <article class="essay-card">
          <span class="essay-num">01</span>
          <h2 class="essay-heading">Proportional Harmony in Small-Scale Systems</h2>
          <p class="essay-excerpt">Establishing crisp 1px hairlines and predictable vertical cadence across desktop and pocket viewports.</p>
          <a href="#essays" class="read-link">Read Monograph →</a>
        </article>
        <article class="essay-card">
          <span class="essay-num">02</span>
          <h2 class="essay-heading">Paper Grain, Contrast &amp; Legible Serif Rhythm</h2>
          <p class="essay-excerpt">Pairing high-contrast display serifs with tabular monospace numerals for technical footnotes.</p>
          <a href="#archive" class="read-link">Read Monograph →</a>
        </article>
        <article class="essay-card">
          <span class="essay-num">03</span>
          <h2 class="essay-heading">Tactile Direct Manipulation in Browser Studios</h2>
          <p class="essay-excerpt">How sub-pixel nudging and immediate visual feedback shorten the loop from thought to form.</p>
          <a href="#colophon" class="read-link">Read Monograph →</a>
        </article>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #f6f4ef;
  --bg-surface: #fbfaf7;
  --text-primary: #1c1917;
  --text-secondary: #57534e;
  --accent-color: #9a3412;
  --border-color: #ddd6c9;
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-body: "Plus Jakarta Sans", -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-body);
  line-height: 1.6;
}

.shell {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 28px;
}

.masthead {
  border-bottom: 1px solid var(--border-color);
  padding: 18px 0;
}

.masthead-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.issue-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.brand-serif {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  letter-spacing: -0.02em;
}

.masthead-nav {
  display: flex;
  gap: 22px;
}

.masthead-nav a {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
}

.editorial-hero {
  padding: 64px 0 48px;
  border-bottom: 1px solid var(--border-color);
  max-width: 780px;
}

.kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-color);
  margin-bottom: 14px;
}

.display-title {
  font-family: var(--font-display);
  font-size: 54px;
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.02em;
  margin-bottom: 18px;
}

.dek {
  font-size: 17px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.byline-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.editorial-btn {
  margin-left: auto;
  padding: 8px 16px;
  border: 1px solid var(--text-primary);
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.editorial-btn.saved {
  background: var(--text-primary);
  color: var(--bg-page);
}

.essay-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--border-color);
}

.essay-card {
  padding: 28px 24px 32px 0;
  border-right: 1px solid var(--border-color);
  padding-left: 24px;
}

.essay-card:first-child {
  padding-left: 0;
}

.essay-card:last-child {
  border-right: none;
}

.essay-num {
  display: block;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.essay-heading {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 10px;
}

.essay-excerpt {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 18px;
}

.read-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
}

@media (max-width: 760px) {
  .display-title {
    font-size: 38px;
  }
  .essay-columns {
    grid-template-columns: 1fr;
  }
  .essay-card {
    padding-left: 0;
    padding-right: 0;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
`,
      },
      {
        path: 'app.js',
        name: 'app.js',
        type: 'js',
        content: `const btn = document.getElementById('bookmark-btn');
if (btn) {
  btn.addEventListener('click', () => {
    const saved = btn.classList.toggle('saved');
    btn.textContent = saved ? 'Saved in Reading List ✓' : 'Save to Reading List';
  });
}
`,
      },
    ],
  },
  {
    id: 'kanso-commerce',
    name: 'Kanso Objects Store',
    category: 'Commerce',
    description: 'Minimal industrial goods storefront with live bag counter, product grid, and clean specs.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kanso Objects — Precision Deskware</title>
    <meta name="description" content="Milled aluminum desk tools, analog timers, and studio stationery built to last." />
    <meta property="og:title" content="Kanso Objects" />
    <meta property="og:description" content="Precision milled aluminum deskware and studio tools." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="store-bar">
      <div class="wrap bar-flex">
        <a href="#" class="store-brand">KANSO OBJECTS</a>
        <nav class="store-nav">
          <a href="#catalog">Objects</a>
          <a href="#specs">Materials</a>
          <a href="#studio">Studio</a>
        </nav>
        <button id="bag-pill" class="bag-btn" type="button">Bag (<span id="bag-count">0</span>)</button>
      </div>
    </header>

    <main class="wrap">
      <section class="store-hero">
        <div class="hero-copy">
          <p class="series-tag">Series 04 · Anodized Aluminum</p>
          <h1 class="store-title">Machined studio instruments for focused daily work.</h1>
          <p class="store-sub">Weighted desk trays, mechanical timers, and solid brass drafting pens milled in small runs.</p>
          <button id="shop-cta" class="primary-shop-btn" type="button">Explore Collection</button>
        </div>
        <div class="hero-spec-panel">
          <div class="spec-row"><span>Alloy</span><strong>6061-T6 Aerospace</strong></div>
          <div class="spec-row"><span>Finish</span><strong>Bead-Blasted Matte</strong></div>
          <div class="spec-row"><span>Tolerance</span><strong>±0.02 mm CNC</strong></div>
          <div class="spec-row"><span>Dispatch</span><strong>Ships in 24 hrs</strong></div>
        </div>
      </section>

      <section id="catalog" class="product-grid">
        <article class="product-card">
          <div class="swatch-stage swatch-slate"><span>01 / TIMER</span></div>
          <div class="product-body">
            <div class="product-top">
              <h2 class="product-name">Chrono Dial 60</h2>
              <span class="product-price">$128</span>
            </div>
            <p class="product-desc">Silent sweep mechanical focus timer with knurled crown.</p>
            <button class="add-bag-btn" data-item="Chrono Dial 60" type="button">Add to Bag</button>
          </div>
        </article>

        <article class="product-card">
          <div class="swatch-stage swatch-sand"><span>02 / TRAY</span></div>
          <div class="product-body">
            <div class="product-top">
              <h2 class="product-name">Monolith Valet</h2>
              <span class="product-price">$84</span>
            </div>
            <p class="product-desc">CNC-milled desk tray lined with natural merino felt.</p>
            <button class="add-bag-btn" data-item="Monolith Valet" type="button">Add to Bag</button>
          </div>
        </article>

        <article class="product-card">
          <div class="swatch-stage swatch-ink"><span>03 / PEN</span></div>
          <div class="product-body">
            <div class="product-top">
              <h2 class="product-name">Vector Brass Pen</h2>
              <span class="product-price">$62</span>
            </div>
            <p class="product-desc">Balanced hexagonal drafting barrel with micro ceramic tip.</p>
            <button class="add-bag-btn" data-item="Vector Brass Pen" type="button">Add to Bag</button>
          </div>
        </article>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #f5f5f4;
  --bg-surface: #ffffff;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --accent-color: #18181b;
  --border-color: #e4e4e7;
  --radius-card: 12px;
  --font-body: "DM Sans", -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.5;
}

.wrap {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 24px;
}

.store-bar {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  padding: 14px 0;
}

.bar-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.store-brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-primary);
  text-decoration: none;
}

.store-nav {
  display: flex;
  gap: 24px;
}

.store-nav a {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
}

.bag-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-page);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.store-hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
  padding: 44px 0 36px;
  align-items: center;
}

.series-tag {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.store-title {
  font-size: 38px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 14px;
}

.store-sub {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 22px;
}

.primary-shop-btn {
  padding: 11px 20px;
  border-radius: 8px;
  border: none;
  background: var(--accent-color);
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.hero-spec-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 18px 20px;
  display: grid;
  gap: 12px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.spec-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.spec-row span {
  color: var(--text-secondary);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  padding-bottom: 56px;
}

.product-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.swatch-stage {
  height: 150px;
  display: flex;
  align-items: flex-end;
  padding: 14px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.swatch-slate {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  color: #1e293b;
}

.swatch-sand {
  background: linear-gradient(135deg, #f3ece2, #dfd4c3);
  color: #44403c;
}

.swatch-ink {
  background: linear-gradient(135deg, #27272a, #18181b);
  color: #e4e4e7;
}

.product-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.product-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.product-name {
  font-size: 16px;
  font-weight: 700;
}

.product-price {
  font-family: "JetBrains Mono", monospace;
  font-size: 14px;
  font-weight: 600;
}

.product-desc {
  font-size: 13px;
  color: var(--text-secondary);
  flex: 1;
}

.add-bag-btn {
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-page);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 780px) {
  .store-hero,
  .product-grid {
    grid-template-columns: 1fr;
  }
}
`,
      },
      {
        path: 'app.js',
        name: 'app.js',
        type: 'js',
        content: `let bagCount = 0;
const countEl = document.getElementById('bag-count');
const buttons = document.querySelectorAll('.add-bag-btn');

buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    bagCount += 1;
    if (countEl) countEl.textContent = String(bagCount);
    const original = btn.textContent;
    btn.textContent = 'Added ✓';
    setTimeout(() => {
      btn.textContent = original || 'Add to Bag';
    }, 1100);
  });
});
`,
      },
    ],
  },
  {
    id: 'signal-bento',
    name: 'Signal Telemetry Bento',
    category: 'Web App',
    description: 'Dark technical product showcase with modular bento grid, status metrics, and keyboard feel.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Signal Engine — Edge Telemetry</title>
    <meta name="description" content="Sub-millisecond trace ingestion and distributed edge routing for modern engineering teams." />
    <meta property="og:title" content="Signal Engine" />
    <meta property="og:description" content="Edge observability & trace routing workbench." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav-strip">
      <div class="frame nav-row">
        <span class="sig-logo">SIGNAL // V3</span>
        <nav class="sig-links">
          <a href="#bento">Architecture</a>
          <a href="#latency">Benchmarks</a>
        </nav>
        <button id="ping-btn" class="sig-cta" type="button">Run Region Ping</button>
      </div>
    </header>

    <main class="frame">
      <section class="sig-hero">
        <p class="sig-eyebrow">DISTRIBUTED OBSERVABILITY</p>
        <h1 class="sig-h1">Real-time edge routing with zero cold-start jitter</h1>
        <p class="sig-lead">Inspect every packet hop, trace waterfall, and cache hit across 42 global PoPs from one unified surface.</p>
      </section>

      <section id="bento" class="bento-grid">
        <article class="bento-card bento-wide">
          <span class="bento-label">GLOBAL INGESTION</span>
          <h2 class="bento-stat" id="ping-readout">1.42 ms p99</h2>
          <p class="bento-copy">Deterministic Rust worker pipeline streaming structured spans directly to regional storage.</p>
        </article>
        <article class="bento-card">
          <span class="bento-label">ACTIVE REGIONS</span>
          <h2 class="bento-stat">42 PoPs</h2>
          <p class="bento-copy">Automatic anycast failover across North America, Europe, and APAC.</p>
        </article>
        <article class="bento-card">
          <span class="bento-label">COMPRESSION</span>
          <h2 class="bento-stat">6.8× Zstd</h2>
          <p class="bento-copy">Columnar trace batching cuts egress bandwidth while retaining full fidelity.</p>
        </article>
        <article id="latency" class="bento-card bento-wide">
          <span class="bento-label">QUERY ENGINE</span>
          <h2 class="bento-title">SQL + Regex trace correlation in under 120ms</h2>
          <p class="bento-copy">Filter billions of live spans without pre-aggregating custom metrics or dropping high-cardinality keys.</p>
        </article>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #09090b;
  --bg-surface: #121216;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --accent-color: #6366f1;
  --border-color: #27272a;
  --radius-card: 12px;
  --font-body: "Plus Jakarta Sans", -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-body);
  line-height: 1.5;
}

.frame {
  max-width: 1060px;
  margin: 0 auto;
  padding: 0 24px;
}

.nav-strip {
  border-bottom: 1px solid var(--border-color);
  padding: 14px 0;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sig-logo {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.sig-links {
  display: flex;
  gap: 20px;
}

.sig-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
}

.sig-cta {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #4f46e5;
  background: var(--accent-color);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.sig-hero {
  padding: 52px 0 36px;
  max-width: 720px;
}

.sig-eyebrow {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #818cf8;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

.sig-h1 {
  font-size: 42px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 14px;
}

.sig-lead {
  font-size: 16px;
  color: var(--text-secondary);
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding-bottom: 56px;
}

.bento-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 22px;
}

.bento-wide {
  grid-column: span 2;
}

.bento-label {
  display: block;
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: #818cf8;
  margin-bottom: 8px;
}

.bento-stat {
  font-family: "JetBrains Mono", monospace;
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 8px;
}

.bento-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.bento-copy {
  font-size: 13.5px;
  color: var(--text-secondary);
}

@media (max-width: 760px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-wide {
    grid-column: span 1;
  }
  .sig-h1 {
    font-size: 30px;
  }
}
`,
      },
      {
        path: 'app.js',
        name: 'app.js',
        type: 'js',
        content: `const pingBtn = document.getElementById('ping-btn');
const readout = document.getElementById('ping-readout');
if (pingBtn && readout) {
  pingBtn.addEventListener('click', () => {
    const ms = (1.1 + Math.random() * 0.7).toFixed(2);
    readout.textContent = ms + ' ms p99';
  });
}
`,
      },
    ],
  },
  {
    id: 'blank-canvas',
    name: 'Blank Starter Canvas',
    category: 'Starter',
    description: 'Clean responsive starter with semantic sections, CSS variables, and ready-to-edit typography.',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        type: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Untitled Project</title>
    <meta name="description" content="Clean starter canvas ready for visual editing." />
    <meta property="og:title" content="Untitled Project" />
    <meta property="og:description" content="Clean starter canvas ready for visual editing." />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="canvas-page">
      <section class="starter-section">
        <p class="starter-tag">Starter Canvas</p>
        <h1 class="starter-heading">Design your layout visually</h1>
        <p class="starter-copy">Double-click text to edit directly, drag components onto the stage, or press Cmd/Ctrl + K to run quick studio actions.</p>
        <div class="starter-actions">
          <button class="starter-btn primary" type="button">Primary Action</button>
          <button class="starter-btn secondary" type="button">Secondary</button>
        </div>
      </section>
    </main>
  </body>
</html>
`,
      },
      {
        path: 'styles.css',
        name: 'styles.css',
        type: 'css',
        content: `:root {
  --bg-page: #ffffff;
  --bg-surface: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --accent-color: #4f46e5;
  --border-color: #e2e8f0;
  --radius-card: 10px;
  --font-body: "Plus Jakarta Sans", -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.6;
}

.canvas-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 72px 24px;
}

.starter-section {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 40px;
}

.starter-tag {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.starter-heading {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 12px;
}

.starter-copy {
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 560px;
  margin-bottom: 24px;
}

.starter-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.starter-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.starter-btn.primary {
  background-color: var(--accent-color);
  color: #ffffff;
  border: none;
}

.starter-btn.secondary {
  background-color: var(--bg-page);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
`,
      },
    ],
  },
];
