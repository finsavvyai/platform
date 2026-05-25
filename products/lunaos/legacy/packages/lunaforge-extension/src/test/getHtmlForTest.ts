
export function getHtmlForTest(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LunaForge Control Center</title>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="title-section">
        <h1 class="title">
          <span class="logo">🌙</span>
          LunaForge Control Center
        </h1>
      </div>
    </header>
    <main class="main-content">
      <section class="card graph-metrics">
        <div class="card-actions">
          <button id="refreshGraph" class="btn btn-secondary" title="Refresh graph">
            🔄 Refresh Graph
          </button>
        </div>
      </section>
      <section class="card plan-card">
        <div class="card-actions">
          <button id="requestPlan" class="btn btn-primary" title="Request new analysis plan">
            🎯 Request Plan
          </button>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}
