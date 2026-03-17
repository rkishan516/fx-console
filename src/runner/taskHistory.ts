import * as vscode from 'vscode';
import { TaskHistoryEntry } from '../types';

/** Manages task execution history, persisted in workspaceState. */
export class TaskHistory {
  private readonly _state: vscode.Memento;
  private readonly _stateKey = 'fx-console.taskHistory';
  private readonly _maxEntries = 50;
  private readonly _changeEmitter = new vscode.EventEmitter<void>();

  readonly onDidChange = this._changeEmitter.event;

  constructor(state: vscode.Memento) {
    this._state = state;
  }

  getEntries(): TaskHistoryEntry[] {
    return this._state.get<TaskHistoryEntry[]>(this._stateKey, []);
  }

  addEntry(entry: TaskHistoryEntry): void {
    const entries = this.getEntries();
    entries.unshift(entry);
    // Keep only last N entries
    const trimmed = entries.slice(0, this._maxEntries);
    void this._state.update(this._stateKey, trimmed);
    this._changeEmitter.fire();
  }

  updateEntry(id: string, updates: Partial<TaskHistoryEntry>): void {
    const entries = this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...updates };
      void this._state.update(this._stateKey, entries);
      this._changeEmitter.fire();
    }
  }

  clear(): void {
    void this._state.update(this._stateKey, []);
    this._changeEmitter.fire();
  }
}
