import type { SampleTemplate } from '../types/editor';

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    id: 'pulse-dashboard',
    name: 'Pulse Operations App',
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
];
