import * as vscode from 'vscode';
import * as path from 'path';
import { FxCli } from './fxCli';
import { findWorkspaceRoot } from './utils/workspaceRoot';
import { WorkspaceExplorer } from './views/workspaceExplorer';
import { TargetRunner } from './runner/targetRunner';
import { TaskHistory } from './runner/taskHistory';
import { TaskStatusPanel } from './views/taskStatusPanel';
import { PubspecCodeLens } from './providers/pubspecCodeLens';
import { GeneratorPanel } from './views/generatorPanel';
import { GraphPanel } from './views/graphPanel';
import { ProjectItem, TargetItem } from './views/workspaceExplorer';
import { CommonCommandsPanel } from './views/commonCommands';
import { ProjectDetailsPanel } from './views/projectDetailsPanel';
import { MigrationPanel } from './views/migrationPanel';
import { RunOptions } from './types';
import { projectFromUri } from './utils/projectFromUri';
import { buildDestinationPath, validateDestination } from './utils/moveRemove';

async function _pickProjectAndTarget(cli: FxCli): Promise<{ project: string; target: string } | undefined> {
  try {
    const projects = await cli.listProjects();
    const projectPick = await vscode.window.showQuickPick(
      projects.map(p => ({ label: p.name, description: p.type })),
      { placeHolder: 'Select project' }
    );
    if (!projectPick) return undefined;
    const project = projects.find(p => p.name === projectPick.label)!;
    const target = await vscode.window.showQuickPick(Object.keys(project.targets), {
      placeHolder: 'Select target',
    });
    if (!target) return undefined;
    return { project: project.name, target };
  } catch {
    return undefined;
  }
}

let statusBarItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('fx-console');
  const fxBinary = config.get<string>('fxBinaryPath', 'fx');
  const cli = new FxCli(fxBinary);

  // Check if fx is available
  const fxAvailable = await cli.isFxAvailable();
  if (!fxAvailable) {
    vscode.window.showErrorMessage(
      'fx CLI not found on PATH. Please install fx and ensure it is on your PATH.',
      'Learn More'
    );
    return;
  }

  // Detect workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const firstFolder = workspaceFolders?.[0]?.uri.fsPath;
  const workspaceRoot = firstFolder ? findWorkspaceRoot(firstFolder) : undefined;

  if (!workspaceRoot) {
    await vscode.commands.executeCommand('setContext', 'fxConsole.workspaceFound', false);
    return;
  }

  await vscode.commands.executeCommand('setContext', 'fxConsole.workspaceFound', true);

  // Initialize services
  const taskHistory = new TaskHistory(context.workspaceState);
  const targetRunner = new TargetRunner(cli, taskHistory);

  // Register tree views
  const workspaceExplorer = new WorkspaceExplorer(cli);
  const treeView = vscode.window.createTreeView('fxConsole.workspaceExplorer', {
    treeDataProvider: workspaceExplorer,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const taskStatusPanel = new TaskStatusPanel(taskHistory);
  const statusView = vscode.window.createTreeView('fxConsole.taskStatus', {
    treeDataProvider: taskStatusPanel,
  });
  context.subscriptions.push(statusView);

  const commonCommandsPanel = new CommonCommandsPanel();
  const commonCommandsView = vscode.window.createTreeView('fxConsole.commonCommands', {
    treeDataProvider: commonCommandsPanel,
  });
  context.subscriptions.push(commonCommandsView);

  // Register code lens provider
  const codeLensProvider = new PubspecCodeLens(cli, workspaceRoot);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', pattern: '**/pubspec.yaml' },
      codeLensProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('fx-console.refreshExplorer', () => {
      workspaceExplorer.refresh();
    }),

    vscode.commands.registerCommand(
      'fx-console.runTarget',
      (project?: string, target?: string) => targetRunner.run(project, target)
    ),

    vscode.commands.registerCommand(
      'fx-console.runVerbose',
      (project?: string, target?: string) => targetRunner.run(project, target, true)
    ),

    vscode.commands.registerCommand('fx-console.runMany', () =>
      targetRunner.runMany()
    ),

    vscode.commands.registerCommand('fx-console.runAffected', () =>
      targetRunner.runAffected()
    ),

    vscode.commands.registerCommand('fx-console.generate', () => {
      const panel = new GeneratorPanel(context, cli, workspaceRoot);
      panel.show();
    }),

    vscode.commands.registerCommand('fx-console.showGraph', async () => {
      const panel = new GraphPanel(context, cli);
      await panel.show();
    }),

    vscode.commands.registerCommand('fx-console.showAffected', async () => {
      const panel = new GraphPanel(context, cli);
      await panel.show();
      try {
        const affectedProjects = await cli.getAffectedProjects();
        await panel.highlightAffected(affectedProjects);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to get affected projects: ${String(err)}`);
      }
    }),

    vscode.commands.registerCommand(
      'fx-console.showProjectDetails',
      async (item?: ProjectItem) => {
        const detailsPanel = new ProjectDetailsPanel(context, cli);
        if (item instanceof ProjectItem) {
          await detailsPanel.show(item.project.name);
        } else {
          try {
            const projects = await cli.listProjects();
            const selected = await vscode.window.showQuickPick(
              projects.map(p => ({ label: p.name, description: p.type })),
              { placeHolder: 'Select project' }
            );
            if (selected) {
              await detailsPanel.show(selected.label);
            }
          } catch {
            // ignore
          }
        }
      }
    ),

    vscode.commands.registerCommand('fx-console.clearHistory', () => {
      taskHistory.clear();
      taskStatusPanel.refresh();
    }),

    vscode.commands.registerCommand(
      'fx-console.rerunTask',
      (entry?: { project: string; target: string; verbose?: boolean }) => {
        if (entry) {
          targetRunner.run(entry.project, entry.target, entry.verbose);
        }
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.copyTaskCommand',
      async (item?: TargetItem) => {
        let project: string | undefined;
        let target: string | undefined;
        if (item instanceof TargetItem) {
          project = item.projectName;
          target = item.targetName;
        } else {
          const picked = await _pickProjectAndTarget(cli);
          if (!picked) return;
          project = picked.project;
          target = picked.target;
        }
        const cmd = cli.buildRunCommand(project, target);
        await vscode.env.clipboard.writeText(cmd);
        vscode.window.showInformationMessage(`Copied: ${cmd}`);
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.revealInExplorer',
      async (item?: ProjectItem) => {
        let projectPath: string | undefined;
        if (item instanceof ProjectItem) {
          projectPath = item.project.path;
        } else {
          try {
            const projects = await cli.listProjects();
            const selected = await vscode.window.showQuickPick(
              projects.map(p => ({ label: p.name, description: p.path })),
              { placeHolder: 'Select project to reveal' }
            );
            if (!selected) return;
            projectPath = projects.find(p => p.name === selected.label)?.path;
          } catch {
            return;
          }
        }
        if (projectPath) {
          await vscode.commands.executeCommand(
            'revealInExplorer',
            vscode.Uri.file(projectPath)
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.runSkipCache',
      (item?: TargetItem) => {
        const opts: RunOptions = { skipCache: true };
        if (item instanceof TargetItem) {
          return targetRunner.runWithOptions(item.projectName, item.targetName, opts);
        }
        return targetRunner.runWithOptions(undefined, undefined, opts);
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.runTargetFromExplorer',
      async (uri?: vscode.Uri) => {
        if (!uri) {
          return targetRunner.run();
        }
        try {
          const projects = await cli.listProjects();
          const project = projectFromUri(uri.fsPath, projects);
          if (project) {
            const targets = Object.keys(project.targets);
            const target = targets.length === 1
              ? targets[0]
              : await vscode.window.showQuickPick(targets, { placeHolder: 'Select target' });
            if (target) {
              await targetRunner.run(project.name, target);
            }
          } else {
            await targetRunner.run();
          }
        } catch {
          await targetRunner.run();
        }
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.generateFromExplorer',
      () => {
        const panel = new GeneratorPanel(context, cli, workspaceRoot);
        panel.show();
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.runWithOptions',
      (item?: TargetItem) => {
        if (item instanceof TargetItem) {
          return targetRunner.runWithOptionsUI(item.projectName, item.targetName);
        }
        return targetRunner.runWithOptionsUI();
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.runTerminalCommand',
      (command: string) => {
        const terminal = vscode.window.createTerminal('fx');
        terminal.show();
        terminal.sendText(command);
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.editCommonCommands',
      () => {
        void vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'fx-console.commonCommands'
        );
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.moveProject',
      async (item?: ProjectItem) => {
        let projectName: string | undefined;
        let projectPath: string | undefined;
        if (item instanceof ProjectItem) {
          projectName = item.project.name;
          projectPath = item.project.path;
        } else {
          try {
            const projects = await cli.listProjects();
            const selected = await vscode.window.showQuickPick(
              projects.map(p => ({ label: p.name, description: p.path })),
              { placeHolder: 'Select project to move' }
            );
            if (!selected) return;
            projectName = selected.label;
            projectPath = projects.find(p => p.name === selected.label)?.path;
          } catch {
            return;
          }
        }
        if (!projectName || !projectPath) return;

        const destination = await vscode.window.showInputBox({
          prompt: `Move "${projectName}" to new location`,
          placeHolder: 'packages/new_location',
          validateInput: validateDestination,
        });
        if (!destination) return;

        const destPath = buildDestinationPath(workspaceRoot, destination);
        try {
          await vscode.workspace.fs.rename(
            vscode.Uri.file(projectPath),
            vscode.Uri.file(destPath),
            { overwrite: false }
          );
          workspaceExplorer.refresh();
          vscode.window.showInformationMessage(`Moved "${projectName}" to ${destPath}`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to move project: ${String(err)}`);
        }
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.removeProject',
      async (item?: ProjectItem) => {
        let projectName: string | undefined;
        let projectPath: string | undefined;
        if (item instanceof ProjectItem) {
          projectName = item.project.name;
          projectPath = item.project.path;
        } else {
          try {
            const projects = await cli.listProjects();
            const selected = await vscode.window.showQuickPick(
              projects.map(p => ({ label: p.name, description: p.path })),
              { placeHolder: 'Select project to remove' }
            );
            if (!selected) return;
            projectName = selected.label;
            projectPath = projects.find(p => p.name === selected.label)?.path;
          } catch {
            return;
          }
        }
        if (!projectName || !projectPath) return;

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to remove "${projectName}"? This will delete the directory at ${projectPath}.`,
          { modal: true },
          'Remove'
        );
        if (confirm !== 'Remove') return;

        try {
          await vscode.workspace.fs.delete(vscode.Uri.file(projectPath), { recursive: true });
          workspaceExplorer.refresh();
          vscode.window.showInformationMessage(`Removed "${projectName}"`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to remove project: ${String(err)}`);
        }
      }
    ),

    vscode.commands.registerCommand(
      'fx-console.focusInGraph',
      async (item?: ProjectItem) => {
        const panel = new GraphPanel(context, cli);
        await panel.show();
        if (item instanceof ProjectItem) {
          await panel.focusProject(item.project.name);
        } else {
          try {
            const projects = await cli.listProjects();
            const selected = await vscode.window.showQuickPick(
              projects.map(p => ({ label: p.name, description: p.type })),
              { placeHolder: 'Select project to focus' }
            );
            if (selected) {
              await panel.focusProject(selected.label);
            }
          } catch {
            // graph still opens
          }
        }
      }
    ),

    vscode.commands.registerCommand('fx-console.showMigrations', () => {
      const panel = new MigrationPanel(context, cli);
      panel.show();
    }),

    vscode.commands.registerCommand(
      'fx-console.focusInGraphFromExplorer',
      async (uri?: vscode.Uri) => {
        const panel = new GraphPanel(context, cli);
        await panel.show();
        if (uri) {
          try {
            const projects = await cli.listProjects();
            const project = projectFromUri(uri.fsPath, projects);
            if (project) {
              await panel.focusProject(project.name);
            }
          } catch {
            // ignore — graph still opens
          }
        }
      }
    )
  );

  // File watcher for auto-refresh
  const watcher = vscode.workspace.createFileSystemWatcher('**/pubspec.yaml');
  const fxWatcher = vscode.workspace.createFileSystemWatcher('**/fx.yaml');
  watcher.onDidChange(() => workspaceExplorer.refresh());
  watcher.onDidCreate(() => workspaceExplorer.refresh());
  watcher.onDidDelete(() => workspaceExplorer.refresh());
  fxWatcher.onDidChange(() => workspaceExplorer.refresh());
  context.subscriptions.push(watcher, fxWatcher);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'fx-console.refreshExplorer';
  statusBarItem.text = '$(extensions) Fx: loading...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Load initial project count for status bar
  try {
    const projects = await cli.listProjects();
    statusBarItem.text = `$(extensions) Fx: ${projects.length} project${projects.length !== 1 ? 's' : ''}`;
  } catch {
    statusBarItem.text = '$(extensions) Fx: error';
  }

  // Register extension path for webviews
  context.subscriptions.push(
    vscode.commands.registerCommand('fx-console._getExtensionPath', () =>
      path.join(context.extensionPath)
    )
  );
}

export function deactivate(): void {
  statusBarItem?.dispose();
}
