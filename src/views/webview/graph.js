// Graph visualization — loaded with nonce, no inline scripts
// Adapted from fx graph_web_server.dart HTML template
// - Replaced fetch('/api/graph') with postMessage data injection
// - Replaced hardcoded colors with VS Code CSS variables
// - Receives rich graph data: {nodes: [{id, type, tags, path}], edges: [{source, target}], groups?}
(function () {
  // Type colors use CSS custom properties that the extension injects via the HTML
  const typeColors = {
    dart_package: 'var(--fx-color-dart-package, #58a6ff)',
    flutter_package: 'var(--fx-color-flutter-package, #a371f7)',
    flutter_app: 'var(--fx-color-flutter-app, #f778ba)',
    dart_cli: 'var(--fx-color-dart-cli, #3fb950)',
  };

  const vscode = acquireVsCodeApi();

  function defaultColor() {
    return 'var(--vscode-textLink-foreground, #58a6ff)';
  }

  function renderGraph(data) {
    document.getElementById('loading').style.display = 'none';

    // Clear SVG for re-renders
    const svg = document.getElementById('graph');
    while (svg.children.length > 1) svg.removeChild(svg.lastChild); // keep <defs>
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nodes = data.nodes;
    const edges = data.edges;

    // Initialize positions — grid layout as starting point
    const pos = {};
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, i) => {
      pos[n.id] = {
        x: 150 + (i % cols) * (w - 300) / Math.max(cols - 1, 1),
        y: 100 + Math.floor(i / cols) * 80,
      };
    });

    // Force-directed iterations (repulsion + spring attraction)
    for (let iter = 0; iter < 100; iter++) {
      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = pos[a.id].x - pos[b.id].x;
          const dy = pos[a.id].y - pos[b.id].y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = 5000 / (d * d);
          pos[a.id].x += (dx / d) * f;
          pos[a.id].y += (dy / d) * f;
          pos[b.id].x -= (dx / d) * f;
          pos[b.id].y -= (dy / d) * f;
        }
      }
      // Spring attraction along edges
      edges.forEach(e => {
        if (!pos[e.source] || !pos[e.target]) return;
        const dx = pos[e.target].x - pos[e.source].x;
        const dy = pos[e.target].y - pos[e.source].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 150) * 0.01;
        pos[e.source].x += (dx / d) * f;
        pos[e.source].y += (dy / d) * f;
        pos[e.target].x -= (dx / d) * f;
        pos[e.target].y -= (dy / d) * f;
      });
    }

    // Center the layout
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, pos[n.id].x);
      minY = Math.min(minY, pos[n.id].y);
      maxX = Math.max(maxX, pos[n.id].x);
      maxY = Math.max(maxY, pos[n.id].y);
    });
    const cx = (maxX + minX) / 2;
    const cy = (maxY + minY) / 2;
    nodes.forEach(n => {
      pos[n.id].x += w / 2 - cx;
      pos[n.id].y += h / 2 - cy;
    });

    // Capture for post-render message handling
    _nodeEls = [];
    _edgeEls = [];

    // Draw edges
    const edgeEls = edges.map(e => {
      if (!pos[e.source] || !pos[e.target]) return null;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pos[e.source].x);
      line.setAttribute('y1', pos[e.source].y);
      line.setAttribute('x2', pos[e.target].x);
      line.setAttribute('y2', pos[e.target].y);
      line.setAttribute('class', 'link');
      line.dataset.source = e.source;
      line.dataset.target = e.target;
      svg.appendChild(line);
      return line;
    }).filter(Boolean);
    _edgeEls = edgeEls;

    // Draw nodes
    const nodeEls = nodes.map(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'node');
      g.dataset.id = n.id;
      g.setAttribute('transform', `translate(${pos[n.id].x},${pos[n.id].y})`);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 8);
      circle.style.fill = typeColors[n.type] || defaultColor();
      circle.style.stroke = 'var(--vscode-editor-background)';

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dx', 14);
      text.setAttribute('dy', 4);
      text.textContent = n.id;

      g.appendChild(circle);
      g.appendChild(text);
      svg.appendChild(g);

      g.addEventListener('click', () => {
        const infoPanel = document.getElementById('info');
        infoPanel.style.display = 'block';
        document.getElementById('infoName').textContent = n.id;
        document.getElementById('infoType').textContent = 'Type: ' + n.type;
        const deps = edges.filter(e => e.source === n.id).map(e => e.target);
        document.getElementById('infoDeps').textContent = deps.length
          ? 'Deps: ' + deps.join(', ')
          : 'No dependencies';
        document.getElementById('infoTags').textContent =
          n.tags && n.tags.length ? 'Tags: ' + n.tags.join(', ') : '';

        // Highlight connected nodes
        const connected = new Set([n.id]);
        edges.forEach(e => {
          if (e.source === n.id || e.target === n.id) {
            connected.add(e.source);
            connected.add(e.target);
          }
        });
        nodeEls.forEach(el => {
          if (el) el.classList.toggle('dimmed', !connected.has(el.dataset.id));
        });
        edgeEls.forEach(el => {
          if (!el) return;
          const isDimmed =
            !connected.has(el.dataset.source) || !connected.has(el.dataset.target);
          const isHighlighted =
            el.dataset.source === n.id || el.dataset.target === n.id;
          el.classList.toggle('dimmed', isDimmed);
          el.classList.toggle('highlighted', isHighlighted);
        });

        // Notify extension to reveal project in tree
        vscode.postMessage({ type: 'selectProject', name: n.id });
      });

      return g;
    });
    _nodeEls = nodeEls;

    // Draw folder group boxes
    if (data.groups) {
      data.groups.forEach(g => {
        const members = g.projects.map(id => pos[id]).filter(Boolean);
        if (members.length < 2) return;
        const pad = 30;
        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
        members.forEach(p => {
          gMinX = Math.min(gMinX, p.x);
          gMinY = Math.min(gMinY, p.y);
          gMaxX = Math.max(gMaxX, p.x);
          gMaxY = Math.max(gMaxY, p.y);
        });
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', gMinX - pad);
        rect.setAttribute('y', gMinY - pad);
        rect.setAttribute('width', gMaxX - gMinX + pad * 2);
        rect.setAttribute('height', gMaxY - gMinY + pad * 2);
        rect.setAttribute('class', 'group-box');
        svg.insertBefore(rect, svg.firstChild.nextSibling);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', gMinX - pad + 6);
        label.setAttribute('y', gMinY - pad + 14);
        label.setAttribute('class', 'group-label');
        label.textContent = g.folder + '/';
        svg.insertBefore(label, rect.nextSibling);
      });
    }

    // Search filter
    document.getElementById('search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      let count = 0;
      nodeEls.forEach(el => {
        if (!el) return;
        const match = !q || el.dataset.id.toLowerCase().includes(q);
        el.style.display = match ? '' : 'none';
        if (match) count++;
      });
      edgeEls.forEach(el => {
        if (!el) return;
        const sMatch = !q || el.dataset.source.toLowerCase().includes(q);
        const tMatch = !q || el.dataset.target.toLowerCase().includes(q);
        el.style.display = sMatch && tMatch ? '' : 'none';
      });
      document.getElementById('count').textContent =
        q ? count + ' projects' : nodes.length + ' projects';
    });

    document.getElementById('count').textContent = nodes.length + ' projects';
  }

  // Module-level state for post-render message handling
  let _nodeEls = [];
  let _edgeEls = [];

  function applyHighlight(nodeSet) {
    _nodeEls.forEach(el => {
      if (el) el.classList.toggle('highlighted-affected', nodeSet.has(el.dataset.id));
      if (el) el.classList.toggle('dimmed', !nodeSet.has(el.dataset.id));
    });
    _edgeEls.forEach(el => {
      if (!el) return;
      const inSet = nodeSet.has(el.dataset.source) && nodeSet.has(el.dataset.target);
      el.classList.toggle('dimmed', !inSet);
    });
  }

  function clearHighlight() {
    _nodeEls.forEach(el => {
      if (el) {
        el.classList.remove('highlighted-affected', 'dimmed');
      }
    });
    _edgeEls.forEach(el => {
      if (el) el.classList.remove('dimmed', 'highlighted');
    });
  }

  // Receive messages via postMessage from extension
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'graphData') {
      clearHighlight();
      renderGraph(message.data);
    } else if (message.type === 'highlightAffected') {
      const affected = new Set(message.projects || []);
      if (affected.size === 0) {
        clearHighlight();
      } else {
        applyHighlight(affected);
      }
    } else if (message.type === 'focusProject') {
      // Build transitive dependency set
      const focusSet = new Set([message.name]);
      let changed = true;
      while (changed) {
        changed = false;
        _edgeEls.forEach(el => {
          if (!el) return;
          if (focusSet.has(el.dataset.source) && !focusSet.has(el.dataset.target)) {
            focusSet.add(el.dataset.target);
            changed = true;
          }
        });
      }
      applyHighlight(focusSet);
    }
  });
})();
