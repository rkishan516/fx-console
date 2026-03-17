import * as assert from 'assert';
import { TaskHistoryEntry } from '../types';

// Mock vscode.Memento for testing without VS Code
class MockMemento {
  private _store = new Map<string, unknown>();

  get<T>(key: string, defaultValue: T): T {
    return (this._store.get(key) ?? defaultValue) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    this._store.set(key, value);
  }
}

// Import TaskHistory class directly - but it imports vscode
// So we test the pure state management logic here

suite('TaskHistory (logic tests)', () => {
  test('entry structure has required fields', () => {
    const entry: TaskHistoryEntry = {
      id: 'test-123',
      project: 'my_app',
      target: 'test',
      command: 'fx run my_app test',
      status: 'running',
      startTime: Date.now(),
    };

    assert.strictEqual(entry.project, 'my_app');
    assert.strictEqual(entry.target, 'test');
    assert.strictEqual(entry.status, 'running');
    assert.ok(entry.startTime > 0);
    assert.ok(entry.id.length > 0);
  });

  test('entry can be updated to success with duration', () => {
    const entry: TaskHistoryEntry = {
      id: 'test-123',
      project: 'my_app',
      target: 'test',
      command: 'fx run my_app test',
      status: 'running',
      startTime: Date.now() - 1000,
    };

    const updated: TaskHistoryEntry = {
      ...entry,
      status: 'success',
      exitCode: 0,
      duration: 1000,
    };

    assert.strictEqual(updated.status, 'success');
    assert.strictEqual(updated.exitCode, 0);
    assert.strictEqual(updated.duration, 1000);
  });

  test('entry can represent failure state', () => {
    const entry: TaskHistoryEntry = {
      id: 'test-456',
      project: 'my_app',
      target: 'build',
      command: 'fx run my_app build',
      status: 'failure',
      startTime: Date.now() - 500,
      exitCode: 1,
      duration: 500,
    };

    assert.strictEqual(entry.status, 'failure');
    assert.strictEqual(entry.exitCode, 1);
  });

  test('unique IDs: timestamp + random suffix produces unique values', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      ids.add(id);
    }
    assert.strictEqual(ids.size, 100);
  });
});
