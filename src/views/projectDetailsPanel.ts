import * as vscode from 'vscode';
import * as path from 'path';
import { FxCli } from '../fxCli';
import { generateNonce } from '../utils/nonce';
import { formatProjectForDisplay } from '../utils/projectFormatter';

export class ProjectDetailsPanel {
  private static _panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _cli: FxCli
  ) {}

  async show(projectName: string): Promise<void> {
    const existing = ProjectDetailsPanel._panels.get(projectName);
    if (existing) {
      existing.reveal();
      return;
    }

    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      'fxProjectDetails',
      `Fx: ${projectName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._context.extensionPath, 'src', 'views', 'webview')),
        ],
      }
    );

    ProjectDetailsPanel._panels.set(projectName, panel);
    panel.onDidDispose(() => {
      ProjectDetailsPanel._panels.delete(projectName);
    });

    const nonce = generateNonce();
    panel.webview.html = this._getHtml(panel.webview, nonce);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'runTarget') {
        await vscode.commands.executeCommand(
          'fx-console.runTarget',
          message.project,
          message.target
        );
      } else if (message.type === 'openProject') {
        await this.show(message.name);
      }
    });

    await this._sendProjectData(panel.webview, projectName);
  }

  private async _sendProjectData(webview: vscode.Webview, projectName: string): Promise<void> {
    try {
      const project = await this._cli.showProject(projectName);
      const data = formatProjectForDisplay(project);
      await webview.postMessage({ type: 'projectData', data });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to load project details: ${String(err)}`);
    }
  }

  private _getHtml(webview: vscode.Webview, nonce: string): string {
    const webviewPath = path.join(this._context.extensionPath, 'src', 'views', 'webview');
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'projectDetails.css')));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'projectDetails.js')));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>Project Details</title>
</head>
<body>
  <div id="loading">Loading project details...</div>
  <div id="content" style="display:none">
    <header id="header"></header>
    <section id="targets"></section>
    <section id="dependencies"></section>
    <section id="dependents"></section>
  </div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
