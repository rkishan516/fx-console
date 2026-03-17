import * as vscode from 'vscode';
import {
  DEFAULT_COMMON_COMMANDS,
  CommandAction,
  resolveCommandAction,
} from '../utils/commonCommandsData';

export { DEFAULT_COMMON_COMMANDS, resolveCommandAction };

class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly commandName: string,
    action: CommandAction
  ) {
    super(commandName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'fxCommonCommand';
    this.iconPath = new vscode.ThemeIcon(commandIconFor(commandName));
    this.tooltip = action.type === 'vscode' ? commandName : `Run: ${action.command}`;

    if (action.type === 'vscode') {
      this.command = {
        command: action.command,
        title: commandName,
      };
    } else {
      this.command = {
        command: 'fx-console.runTerminalCommand',
        title: commandName,
        arguments: [action.command],
      };
    }
  }
}

export class CommonCommandsPanel implements vscode.TreeDataProvider<CommandItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CommandItem[] {
    const config = vscode.workspace.getConfiguration('fx-console');
    const commands = config.get<string[]>('commonCommands', DEFAULT_COMMON_COMMANDS);
    return commands.map(name => new CommandItem(name, resolveCommandAction(name)));
  }
}

function commandIconFor(name: string): string {
  switch (name) {
    case 'run': return 'play';
    case 'run-many': return 'run-all';
    case 'affected': return 'git-branch';
    case 'generate': return 'add';
    case 'graph': return 'type-hierarchy';
    case 'lint': return 'check';
    default: return 'terminal';
  }
}
