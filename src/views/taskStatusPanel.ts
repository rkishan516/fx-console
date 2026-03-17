import * as vscode from 'vscode';
import { TaskHistory } from '../runner/taskHistory';
import { TaskHistoryEntry } from '../types';

type StatusPanelItem = HistoryItem | DetailItem;

export class TaskStatusPanel implements vscode.TreeDataProvider<StatusPanelItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatusPanelItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly _history: TaskHistory) {
    _history.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StatusPanelItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StatusPanelItem): StatusPanelItem[] {
    if (element instanceof HistoryItem) {
      // Details for an entry
      const items: DetailItem[] = [
        new DetailItem(`Command: ${element.entry.command}`),
        new DetailItem(`Started: ${new Date(element.entry.startTime).toLocaleTimeString()}`),
      ];
      if (element.entry.exitCode !== undefined) {
        items.push(new DetailItem(`Exit code: ${element.entry.exitCode}`));
      }
      return items;
    }

    const entries = this._history.getEntries();
    return entries.map(e => new HistoryItem(e));
  }
}

class HistoryItem extends vscode.TreeItem {
  constructor(public readonly entry: TaskHistoryEntry) {
    const label = `${entry.project}:${entry.target}`;
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'fxHistoryItem';

    const statusIcon = {
      running: '$(sync~spin)',
      success: '$(check)',
      failure: '$(x)',
      cached: '$(database)',
    }[entry.status];

    const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';
    this.description = `${statusIcon} ${entry.status}${durationStr}`;
    this.tooltip = `${label} — ${entry.status}`;
  }
}

class DetailItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'fxHistoryDetail';
  }
}
