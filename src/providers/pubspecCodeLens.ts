import * as vscode from 'vscode';
import * as path from 'path';
import { extractFxTargets, parsePubspec } from '../utils/pubspecParser';
import { FxCli } from '../fxCli';

export class PubspecCodeLens implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private readonly _cli: FxCli,
    private readonly _workspaceRoot: string
  ) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    // Only show code lenses for pubspec.yaml files within the fx workspace
    const docPath = document.uri.fsPath;
    if (!docPath.startsWith(this._workspaceRoot)) {
      return [];
    }

    const content = document.getText();
    const targets = extractFxTargets(content);
    if (targets.length === 0) return [];

    // Get project name from pubspec
    const parsed = parsePubspec(content);
    const projectName = parsed.name;
    if (!projectName) return [];

    const lenses: vscode.CodeLens[] = [];
    for (const target of targets) {
      const range = new vscode.Range(target.line, 0, target.line, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(play) Run',
          command: 'fx-console.runTarget',
          arguments: [projectName, target.name],
          tooltip: `Run: fx run ${projectName} ${target.name}`,
        }),
        new vscode.CodeLens(range, {
          title: '$(debug-alt) Run Verbose',
          command: 'fx-console.runVerbose',
          arguments: [projectName, target.name],
          tooltip: `Run: fx run ${projectName} ${target.name} --verbose`,
        })
      );
    }

    return lenses;
  }

  invalidate(): void {
    this._onDidChangeCodeLenses.fire();
  }
}
