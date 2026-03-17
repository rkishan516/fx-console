import * as vscode from 'vscode';
import { FxCli } from '../fxCli';
import { FxMigration, FxMigrationStep } from '../types';
import { generateNonce } from '../utils/nonce';

/**
 * Migration step-through panel — shows available migrations and lets users
 * preview and apply them one at a time.
 */
export class MigrationPanel {
  private static _currentPanel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _cli: FxCli
  ) {}

  async show(): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (MigrationPanel._currentPanel) {
      MigrationPanel._currentPanel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'fxMigration',
      'Fx: Migrations',
      column,
      { enableScripts: true }
    );
    MigrationPanel._currentPanel = panel;

    panel.onDidDispose(() => {
      MigrationPanel._currentPanel = undefined;
    });

    let migrations: FxMigration[] = [];
    try {
      migrations = await this._cli.listMigrations();
    } catch {
      // Empty list is fine
    }

    const nonce = generateNonce();
    panel.webview.html = this._getHtml(nonce, migrations);

    panel.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'preview': {
          try {
            const steps = await this._cli.previewMigration(
              message.pluginName, message.fromVersion, message.toVersion
            );
            panel.webview.postMessage({ type: 'previewResult', steps });
          } catch (err) {
            panel.webview.postMessage({
              type: 'error',
              message: `Preview failed: ${String(err)}`
            });
          }
          break;
        }
        case 'apply': {
          try {
            const output = await this._cli.applyMigration(
              message.pluginName, message.fromVersion, message.toVersion
            );
            panel.webview.postMessage({
              type: 'applied',
              pluginName: message.pluginName,
              fromVersion: message.fromVersion,
              toVersion: message.toVersion,
              output,
            });
            vscode.window.showInformationMessage(
              `Applied migration: ${message.pluginName} ${message.fromVersion} → ${message.toVersion}`
            );
          } catch (err) {
            panel.webview.postMessage({
              type: 'error',
              message: `Apply failed: ${String(err)}`
            });
          }
          break;
        }
      }
    });
  }

  private _getHtml(nonce: string, migrations: FxMigration[]): string {
    const migrationsJson = JSON.stringify(migrations);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fx Migrations</title>
  <style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
    h1 { font-size: 1.4em; margin-bottom: 8px; }
    .empty { color: var(--vscode-descriptionForeground); font-style: italic; }
    .migration-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--vscode-editor-background);
    }
    .migration-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .migration-title { font-weight: bold; }
    .migration-version { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
    .btn {
      padding: 4px 12px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      margin-left: 4px;
    }
    .btn-preview {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-apply {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .changes { margin-top: 8px; font-size: 0.85em; }
    .change-item {
      padding: 4px 8px;
      border-left: 3px solid var(--vscode-textLink-foreground);
      margin-bottom: 4px;
      background: var(--vscode-textBlockQuote-background);
    }
    .change-type { font-weight: bold; text-transform: uppercase; font-size: 0.8em; }
    .change-file { color: var(--vscode-textLink-foreground); }
    .change-desc { color: var(--vscode-descriptionForeground); }
    .applied { opacity: 0.5; }
    .applied .migration-title::after { content: ' ✓ Applied'; color: var(--vscode-testing-iconPassed); }
    .error { color: var(--vscode-errorForeground); margin-top: 8px; }
    .status { margin-top: 4px; font-style: italic; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <h1>Migration Step-Through</h1>
  <p>Review and apply migrations one step at a time. Preview changes before applying.</p>
  <div id="migrations"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const migrations = ${migrationsJson};
    const appliedSet = new Set();
    let previewData = {};

    function render() {
      const container = document.getElementById('migrations');
      if (migrations.length === 0) {
        container.innerHTML = '<p class="empty">No migrations available.</p>';
        return;
      }

      container.innerHTML = migrations.map((m, i) => {
        const key = m.pluginName + ':' + m.fromVersion + ':' + m.toVersion;
        const isApplied = appliedSet.has(key);
        const preview = previewData[key];
        const appliedClass = isApplied ? ' applied' : '';

        let changesHtml = '';
        if (preview && preview.length > 0) {
          changesHtml = '<div class="changes">' +
            preview.flatMap(step => step.changes.map(c =>
              '<div class="change-item">' +
                '<span class="change-type">' + c.type + '</span> ' +
                '<span class="change-file">' + c.filePath + '</span>' +
                (c.description ? '<div class="change-desc">' + c.description + '</div>' : '') +
              '</div>'
            )).join('') +
            '</div>';
        }

        return '<div class="migration-card' + appliedClass + '" data-key="' + key + '">' +
          '<div class="migration-header">' +
            '<div>' +
              '<div class="migration-title">' + m.pluginName + '</div>' +
              '<div class="migration-version">' + m.fromVersion + ' → ' + m.toVersion + '</div>' +
            '</div>' +
            '<div>' +
              '<button class="btn btn-preview" onclick="previewMigration(' + i + ')"' +
                (isApplied ? ' disabled' : '') + '>Preview</button>' +
              '<button class="btn btn-apply" onclick="applyMigration(' + i + ')"' +
                (isApplied ? ' disabled' : '') + '>Apply</button>' +
            '</div>' +
          '</div>' +
          changesHtml +
          '<div id="status-' + i + '"></div>' +
        '</div>';
      }).join('');
    }

    function previewMigration(index) {
      const m = migrations[index];
      document.getElementById('status-' + index).innerHTML =
        '<div class="status">Loading preview...</div>';
      vscode.postMessage({
        type: 'preview',
        pluginName: m.pluginName,
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
      });
    }

    function applyMigration(index) {
      const m = migrations[index];
      document.getElementById('status-' + index).innerHTML =
        '<div class="status">Applying migration...</div>';
      vscode.postMessage({
        type: 'apply',
        pluginName: m.pluginName,
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
      });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'previewResult') {
        // Find which migration this belongs to
        if (msg.steps && msg.steps.length > 0) {
          const s = msg.steps[0];
          const key = s.pluginName + ':' + s.fromVersion + ':' + s.toVersion;
          previewData[key] = msg.steps;
        }
        render();
      } else if (msg.type === 'applied') {
        const key = msg.pluginName + ':' + msg.fromVersion + ':' + msg.toVersion;
        appliedSet.add(key);
        render();
      } else if (msg.type === 'error') {
        // Show error in the last active status area
        const statusDivs = document.querySelectorAll('[id^="status-"]');
        if (statusDivs.length > 0) {
          statusDivs[statusDivs.length - 1].innerHTML =
            '<div class="error">' + msg.message + '</div>';
        }
      }
    });

    render();
  </script>
</body>
</html>`;
  }
}
