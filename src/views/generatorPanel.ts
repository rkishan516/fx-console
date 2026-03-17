import * as vscode from 'vscode';
import * as path from 'path';
import { FxCli } from '../fxCli';
import { FxGenerator } from '../types';
import { generateNonce } from '../utils/nonce';
import { filterGenerators } from '../utils/generatorFilter';

export class GeneratorPanel {
  private static _currentPanel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _cli: FxCli,
    private readonly _workspaceRoot: string
  ) {}

  async show(): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (GeneratorPanel._currentPanel) {
      GeneratorPanel._currentPanel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'fxGenerator',
      'Fx: Generate',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._context.extensionPath, 'src', 'views', 'webview')),
        ],
      }
    );
    GeneratorPanel._currentPanel = panel;

    panel.onDidDispose(() => {
      GeneratorPanel._currentPanel = undefined;
    });

    let generators: FxGenerator[] = [];
    try {
      const allGenerators = await this._cli.getGenerators();
      const config = vscode.workspace.getConfiguration('fx-console');
      const allowlist = config.get<string[]>('generatorAllowlist', []);
      const blocklist = config.get<string[]>('generatorBlocklist', []);
      generators = filterGenerators(allGenerators, allowlist, blocklist);
    } catch {
      vscode.window.showErrorMessage('Failed to load generators from fx CLI.');
    }

    const nonce = generateNonce();
    panel.webview.html = this._getHtml(panel.webview, nonce, generators);

    panel.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'dryRun': {
          const output = await this._runGenerate(
            message.generator,
            message.name,
            message.directory,
            true,
            message.extraArgs
          );
          await panel.webview.postMessage({ type: 'dryRunResult', output });
          break;
        }
        case 'generate': {
          const output = await this._runGenerate(
            message.generator,
            message.name,
            message.directory,
            false,
            message.extraArgs
          );
          await panel.webview.postMessage({ type: 'generateResult', output });
          break;
        }
      }
    });
  }

  private async _runGenerate(
    generator: string,
    name: string,
    directory: string | undefined,
    dryRun: boolean,
    extraArgs?: string
  ): Promise<string> {
    const args = ['generate', generator, name, '--no-interactive'];
    if (directory) {
      args.push('-d', directory);
    }
    if (dryRun) {
      args.push('--dry-run');
    }
    if (extraArgs) {
      args.push(...extraArgs.split(/\s+/).filter((a: string) => a));
    }

    // Use execFile via CLI bridge — but for generate we capture output
    // by spawning directly
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    try {
      const config = vscode.workspace.getConfiguration('fx-console');
      const fxBinary = config.get<string>('fxBinaryPath', 'fx');
      const { stdout, stderr } = await execFileAsync(fxBinary, args, {
        cwd: this._workspaceRoot,
        timeout: 60_000,
      });
      return stdout || stderr;
    } catch (err: unknown) {
      return `Error: ${String(err)}`;
    }
  }

  private _getHtml(
    webview: vscode.Webview,
    nonce: string,
    generators: FxGenerator[]
  ): string {
    const webviewPath = path.join(
      this._context.extensionPath,
      'src',
      'views',
      'webview'
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewPath, 'generator.css'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewPath, 'generator.js'))
    );

    const generatorOptions = generators
      .map(g => `<option value="${escapeHtml(g.name)}" data-description="${escapeHtml(g.description)}">${escapeHtml(g.name)} — ${escapeHtml(g.description)}</option>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>Fx Generate</title>
</head>
<body>
  <div class="container">
    <h1>Generate</h1>

    <div class="form-group">
      <label for="generator">Generator</label>
      <select id="generator">
        ${generatorOptions}
      </select>
      <div id="generatorDescription" class="hint"></div>
    </div>

    <div class="form-group">
      <label for="name">Project Name</label>
      <input type="text" id="name" placeholder="e.g. my_package" />
      <div class="hint">Must be a valid Dart identifier: lowercase letters, numbers, underscores</div>
    </div>

    <div class="form-group">
      <label for="directory">Output Directory <span class="optional">(optional)</span></label>
      <input type="text" id="directory" placeholder="packages/ (default)" />
    </div>

    <div class="form-group">
      <label for="extraArgs">Additional Arguments <span class="optional">(optional)</span></label>
      <input type="text" id="extraArgs" placeholder="e.g. --some-flag value" />
      <div class="hint">Extra CLI arguments appended to the generate command</div>
    </div>

    <div class="button-row">
      <button id="dryRunBtn" class="secondary">Dry Run</button>
      <button id="generateBtn" class="primary">Generate</button>
    </div>

    <div id="output" class="output" hidden></div>
  </div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
