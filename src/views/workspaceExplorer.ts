import * as vscode from 'vscode';
import { FxCli } from '../fxCli';
import { FxProject } from '../types';
import { getProjectLayout, ProjectViewingStyle } from '../utils/graphDataBuilder';

type WorkspaceTreeItem = FolderItem | ProjectItem | TargetItem | DependencyItem;

export class WorkspaceExplorer implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _projectsCache: FxProject[] | undefined;
  private _cacheTime = 0;
  private static readonly CACHE_TTL_MS = 5000;

  constructor(private readonly _cli: FxCli) {}

  refresh(): void {
    this._projectsCache = undefined;
    this._cacheTime = 0;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    if (!element) {
      return this._getRootItems();
    }
    if (element instanceof FolderItem) {
      return element.projects.map(p => new ProjectItem(p));
    }
    if (element instanceof ProjectItem) {
      const items: WorkspaceTreeItem[] = [];
      // Targets
      for (const [name, target] of Object.entries(element.project.targets)) {
        items.push(new TargetItem(element.project.name, name, target.executor));
      }
      // Dependencies
      for (const dep of element.project.dependencies) {
        items.push(new DependencyItem(dep));
      }
      return items;
    }
    return [];
  }

  private async _getRootItems(): Promise<WorkspaceTreeItem[]> {
    const projects = await this._getCachedProjects();
    if (projects.length === 0) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('fx-console');
    const style = config.get<ProjectViewingStyle>('projectViewingStyle', 'automatic');
    const layout = getProjectLayout(projects, style);

    if (!layout.grouped) {
      return layout.items.map(p => new ProjectItem(p));
    }
    return [...layout.groups.entries()].map(([folder, projs]) => new FolderItem(folder, projs));
  }

  private async _getCachedProjects(): Promise<FxProject[]> {
    const now = Date.now();
    if (this._projectsCache && now - this._cacheTime < WorkspaceExplorer.CACHE_TTL_MS) {
      return this._projectsCache;
    }
    try {
      this._projectsCache = await this._cli.listProjects();
      this._cacheTime = now;
      return this._projectsCache;
    } catch {
      return [];
    }
  }
}

export class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly folderName: string,
    public readonly projects: FxProject[]
  ) {
    super(folderName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'fxFolder';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.description = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
  }
}

export class ProjectItem extends vscode.TreeItem {
  constructor(public readonly project: FxProject) {
    const hasChildren =
      Object.keys(project.targets).length > 0 || project.dependencies.length > 0;
    super(
      project.name,
      hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = 'fxProject';
    this.description = project.type;
    this.tooltip = `${project.name} (${project.type})\n${project.path}`;
    this.iconPath = new vscode.ThemeIcon(projectTypeIcon(project.type));
  }
}

export class TargetItem extends vscode.TreeItem {
  constructor(
    public readonly projectName: string,
    public readonly targetName: string,
    public readonly executor: string
  ) {
    super(targetName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'fxTarget';
    this.description = executor;
    this.iconPath = new vscode.ThemeIcon('play-circle');
    this.tooltip = `Run: fx run ${projectName} ${targetName}`;
    this.command = {
      command: 'fx-console.runTarget',
      title: 'Run Target',
      arguments: [projectName, targetName],
    };
  }
}

class DependencyItem extends vscode.TreeItem {
  constructor(public readonly depName: string) {
    super(depName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'fxDependency';
    this.iconPath = new vscode.ThemeIcon('link');
    this.description = 'dependency';
  }
}

function projectTypeIcon(type: string): string {
  switch (type) {
    case 'flutter_app': return 'device-mobile';
    case 'flutter_package': return 'package';
    case 'dart_package': return 'package';
    case 'dart_cli': return 'terminal';
    default: return 'symbol-package';
  }
}
