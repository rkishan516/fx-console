(function () {
  const vscode = acquireVsCodeApi();

  function render(data) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    // Header
    const header = document.getElementById('header');
    header.innerHTML = `
      <h1>${esc(data.name)}</h1>
      <p class="meta">Type: ${esc(data.type)}</p>
      <p class="meta">Path: ${esc(data.path)}</p>
      ${data.tags.length
        ? '<div class="tags">' + data.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('') + '</div>'
        : ''}
    `;

    // Targets
    const targetsEl = document.getElementById('targets');
    if (data.targets.length === 0) {
      targetsEl.innerHTML = '<h2>Targets</h2><p class="empty">No targets defined</p>';
    } else {
      targetsEl.innerHTML = '<h2>Targets</h2>' + data.targets.map(t => `
        <div class="target-card">
          <div class="target-header">
            <span class="target-name">${esc(t.name)}</span>
            <button class="run-btn" data-target="${esc(t.name)}">Run</button>
          </div>
          <div class="target-executor">${esc(t.executor)}</div>
          ${t.dependsOn.length ? `<div class="target-detail">Depends on: ${t.dependsOn.map(esc).join(', ')}</div>` : ''}
          ${t.inputs.length ? `<div class="target-detail">Inputs: ${t.inputs.map(esc).join(', ')}</div>` : ''}
        </div>
      `).join('');

      targetsEl.querySelectorAll('.run-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({ type: 'runTarget', project: data.name, target: btn.dataset.target });
        });
      });
    }

    // Dependencies
    const depsEl = document.getElementById('dependencies');
    depsEl.innerHTML = '<h2>Dependencies</h2>' + renderDepList(data.dependencies);

    // Dependents
    const deptsEl = document.getElementById('dependents');
    deptsEl.innerHTML = '<h2>Dependents</h2>' + renderDepList(data.dependents);

    // Wire up dep links
    document.querySelectorAll('.dep-link').forEach(link => {
      link.addEventListener('click', () => {
        vscode.postMessage({ type: 'openProject', name: link.dataset.name });
      });
    });
  }

  function renderDepList(items) {
    if (!items || items.length === 0) {
      return '<p class="empty">None</p>';
    }
    return '<ul class="dep-list">' + items.map(name =>
      `<li><a class="dep-link" data-name="${esc(name)}">${esc(name)}</a></li>`
    ).join('') + '</ul>';
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.addEventListener('message', event => {
    if (event.data.type === 'projectData') {
      render(event.data.data);
    }
  });
})();
