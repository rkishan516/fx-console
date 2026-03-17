import * as vscode from 'vscode';
import * as path from 'path';
import { FxCli } from '../fxCli';
import { buildRichGraphData } from '../utils/graphDataBuilder';
import { generateNonce } from '../utils/nonce';

export class GraphPanel {
  private static _currentPanel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _cli: FxCli
  ) {}

  async show(): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (GraphPanel._currentPanel) {
      GraphPanel._currentPanel.reveal(column);
      await this._sendGraphData(GraphPanel._currentPanel.webview);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'fxGraph',
      'Fx: Project Graph',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._context.extensionPath, 'src', 'views', 'webview')),
        ],
      }
    );
    GraphPanel._currentPanel = panel;

    panel.onDidDispose(() => {
      GraphPanel._currentPanel = undefined;
    });

    const nonce = generateNonce();
    panel.webview.html = this._getHtml(panel.webview, nonce);

    panel.webview.onDidReceiveMessage(message => {
      if (message.type === 'selectProject') {
        // Reveal project in workspace explorer
        void vscode.commands.executeCommand(
          'fxConsole.workspaceExplorer.reveal',
          message.name
        );
      }
    });

    await this._sendGraphData(panel.webview);
  }

  async highlightAffected(projectNames: string[]): Promise<void> {
    if (GraphPanel._currentPanel) {
      await GraphPanel._currentPanel.webview.postMessage({
        type: 'highlightAffected',
        projects: projectNames,
      });
    }
  }

  async focusProject(projectName: string): Promise<void> {
    if (GraphPanel._currentPanel) {
      await GraphPanel._currentPanel.webview.postMessage({
        type: 'focusProject',
        name: projectName,
      });
    }
  }

  private async _sendGraphData(webview: vscode.Webview): Promise<void> {
    try {
      const [graphData, projects] = await Promise.all([
        this._cli.getGraphData(),
        this._cli.listProjects(),
      ]);

      const richData = buildRichGraphData(graphData, projects);
      await webview.postMessage({ type: 'graphData', data: richData });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to load graph data: ${String(err)}`);
    }
  }

  private _getHtml(webview: vscode.Webview, nonce: string): string {
    const webviewPath = path.join(
      this._context.extensionPath,
      'src',
      'views',
      'webview'
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewPath, 'graph.css'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewPath, 'graph.js'))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>Fx: Project Graph</title>
</head>
<body>
  <div id="controls">
    <input id="search" type="text" placeholder="Filter projects..." />
    <span id="count"></span>
  </div>
  <div id="info">
    <h3 id="infoName"></h3>
    <p id="infoType"></p>
    <p id="infoDeps"></p>
    <p id="infoTags"></p>
  </div>
  <div id="loading">Loading graph...</div>
  <svg id="graph">
    <defs>
      <marker id="arrowhead" viewBox="0 0 10 10" refX="20" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vscode-widget-border, #30363d)" />
      </marker>
    </defs>
  </svg>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
