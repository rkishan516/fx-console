import * as vscode from 'vscode';
import { FxCli } from '../fxCli';
import { TaskHistory } from './taskHistory';
import { TaskHistoryEntry, RunOptions } from '../types';
import { applyRunOptionsFlags, RUN_OPTION_FLAGS } from '../utils/runOptionsBuilder';

/** Runs fx targets in VS Code terminals and tracks history. */
export class TargetRunner {
  private readonly _terminals = new Map<string, vscode.Terminal>();

  constructor(
    private readonly _cli: FxCli,
    private readonly _history: TaskHistory
  ) {
    vscode.window.onDidCloseTerminal(terminal => {
      // Update history entry when terminal closes
      for (const [key, t] of this._terminals.entries()) {
        if (t === terminal) {
          this._terminals.delete(key);
          const exitCode = terminal.exitStatus?.code;
          // Find the most recent running entry for this key
          const entries = this._history.getEntries();
          const [project, target] = key.split(':');
          const entry = entries.find(
            e => e.project === project && e.target === target && e.status === 'running'
          );
          if (entry) {
            this._history.updateEntry(entry.id, {
              status: exitCode === 0 ? 'success' : 'failure',
              exitCode: exitCode ?? -1,
              duration: Date.now() - entry.startTime,
            });
          }
          break;
        }
      }
    });
  }

  /** Run a target, prompting for project/target if not provided. */
  async run(project?: string, target?: string, verbose = false): Promise<void> {
    if (!project || !target) {
      const picked = await this._pickProjectAndTarget();
      if (!picked) return;
      project = picked.project;
      target = picked.target;
    }

    const terminalKey = `${project}:${target}`;
    const command = this._cli.buildRunCommand(project, target, verbose);

    // Reuse existing terminal if open
    let terminal = this._terminals.get(terminalKey);
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal(`fx: ${project}:${target}`);
      this._terminals.set(terminalKey, terminal);
    }

    terminal.show();
    terminal.sendText(command);

    // Record history entry
    const entry: TaskHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      project,
      target,
      command,
      status: 'running',
      startTime: Date.now(),
    };
    this._history.addEntry(entry);
  }

  /** Run a target with explicit RunOptions, prompting for project/target if not provided. */
  async runWithOptions(project?: string, target?: string, options?: RunOptions): Promise<void> {
    if (!project || !target) {
      const picked = await this._pickProjectAndTarget();
      if (!picked) return;
      project = picked.project;
      target = picked.target;
    }

    const terminalKey = `${project}:${target}`;
    const command = this._cli.buildRunCommand(project, target, options);

    let terminal = this._terminals.get(terminalKey);
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal(`fx: ${project}:${target}`);
      this._terminals.set(terminalKey, terminal);
    }

    terminal.show();
    terminal.sendText(command);

    const entry: TaskHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      project,
      target,
      command,
      status: 'running',
      startTime: Date.now(),
    };
    this._history.addEntry(entry);
  }

  /** Show a multi-step quick pick to configure run options, then execute. */
  async runWithOptionsUI(project?: string, target?: string): Promise<void> {
    if (!project || !target) {
      const picked = await this._pickProjectAndTarget();
      if (!picked) return;
      project = picked.project;
      target = picked.target;
    }

    // Step 1: select boolean flags
    const selectedFlags = await vscode.window.showQuickPick(
      RUN_OPTION_FLAGS,
      {
        canPickMany: true,
        placeHolder: 'Select run options (optional)',
        title: `Run ${project}:${target} with options`,
      }
    );
    if (selectedFlags === undefined) return; // user cancelled

    // Step 2: optional configuration
    const configuration = await vscode.window.showInputBox({
      prompt: 'Configuration name (leave empty to use default)',
      placeHolder: 'e.g. production, staging',
    });
    if (configuration === undefined) return; // user cancelled

    const options = applyRunOptionsFlags(selectedFlags.map(f => f.label), configuration || undefined);
    await this.runWithOptions(project, target, options);
  }

  /** Run a target across many projects. */
  async runMany(): Promise<void> {
    const projects = await this._pickProjects();
    if (!projects) return;
    const target = await this._pickTarget();
    if (!target) return;

    for (const project of projects) {
      await this.run(project, target);
    }
  }

  /** Run a target on affected projects. */
  async runAffected(): Promise<void> {
    const target = await this._pickTarget();
    if (!target) return;

    const terminal = vscode.window.createTerminal(`fx: affected:${target}`);
    terminal.show();
    terminal.sendText(`fx run-many --target ${target} --affected`);
  }

  private async _pickProjectAndTarget(): Promise<{ project: string; target: string } | undefined> {
    try {
      const projects = await this._cli.listProjects();
      const projectName = await vscode.window.showQuickPick(
        projects.map(p => ({ label: p.name, description: p.type })),
        { placeHolder: 'Select project' }
      );
      if (!projectName) return undefined;

      const project = projects.find(p => p.name === projectName.label)!;
      const targetNames = Object.keys(project.targets);
      if (targetNames.length === 0) {
        vscode.window.showWarningMessage(`Project "${project.name}" has no targets defined.`);
        return undefined;
      }

      const target = await vscode.window.showQuickPick(targetNames, {
        placeHolder: 'Select target',
      });
      if (!target) return undefined;

      return { project: project.name, target };
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to list projects: ${String(err)}`);
      return undefined;
    }
  }

  private async _pickProjects(): Promise<string[] | undefined> {
    try {
      const projects = await this._cli.listProjects();
      const selected = await vscode.window.showQuickPick(
        projects.map(p => ({ label: p.name, description: p.type })),
        { placeHolder: 'Select projects', canPickMany: true }
      );
      return selected?.map(s => s.label);
    } catch {
      return undefined;
    }
  }

  private async _pickTarget(): Promise<string | undefined> {
    return vscode.window.showInputBox({ prompt: 'Enter target name (e.g. test, build, analyze)' });
  }
}
