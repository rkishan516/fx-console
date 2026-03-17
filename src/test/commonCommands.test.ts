import * as assert from 'assert';
import { resolveCommandAction, DEFAULT_COMMON_COMMANDS } from '../utils/commonCommandsData';

suite('CommonCommands (pure logic)', () => {
  test('DEFAULT_COMMON_COMMANDS has expected entries', () => {
    assert.ok(DEFAULT_COMMON_COMMANDS.includes('run'));
    assert.ok(DEFAULT_COMMON_COMMANDS.includes('run-many'));
    assert.ok(DEFAULT_COMMON_COMMANDS.includes('affected'));
    assert.ok(DEFAULT_COMMON_COMMANDS.includes('generate'));
    assert.ok(DEFAULT_COMMON_COMMANDS.includes('graph'));
  });

  test('resolveCommandAction returns vscodeCommand for known commands', () => {
    const run = resolveCommandAction('run');
    assert.strictEqual(run.type, 'vscode');
    assert.strictEqual(run.command, 'fx-console.runTarget');

    const affected = resolveCommandAction('affected');
    assert.strictEqual(affected.type, 'vscode');
    assert.strictEqual(affected.command, 'fx-console.runAffected');

    const generate = resolveCommandAction('generate');
    assert.strictEqual(generate.type, 'vscode');
    assert.strictEqual(generate.command, 'fx-console.generate');

    const graph = resolveCommandAction('graph');
    assert.strictEqual(graph.type, 'vscode');
    assert.strictEqual(graph.command, 'fx-console.showGraph');
  });

  test('resolveCommandAction returns terminal action for unknown commands', () => {
    const lint = resolveCommandAction('lint');
    assert.strictEqual(lint.type, 'terminal');
    assert.ok(lint.command.includes('lint'));
  });

  test('resolveCommandAction handles run-many', () => {
    const action = resolveCommandAction('run-many');
    assert.strictEqual(action.type, 'vscode');
    assert.strictEqual(action.command, 'fx-console.runMany');
  });
});
