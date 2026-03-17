import * as assert from 'assert';
import { buildDestinationPath, validateDestination } from '../utils/moveRemove';

suite('Move/Remove project helpers', () => {
  test('buildDestinationPath joins workspace root with relative destination', () => {
    const result = buildDestinationPath('/ws', 'packages/new_location');
    assert.strictEqual(result, '/ws/packages/new_location');
  });

  test('buildDestinationPath handles trailing slashes', () => {
    const result = buildDestinationPath('/ws/', 'packages/new_location/');
    assert.strictEqual(result, '/ws/packages/new_location');
  });

  test('buildDestinationPath handles absolute destination by returning it as-is', () => {
    const result = buildDestinationPath('/ws', '/absolute/path');
    assert.strictEqual(result, '/absolute/path');
  });

  test('validateDestination rejects empty input', () => {
    assert.ok(validateDestination('') !== null);
  });

  test('validateDestination accepts valid relative path', () => {
    assert.strictEqual(validateDestination('packages/my_pkg'), null);
  });

  test('validateDestination accepts valid absolute path', () => {
    assert.strictEqual(validateDestination('/ws/packages/my_pkg'), null);
  });

  test('validateDestination rejects path with ..', () => {
    assert.ok(validateDestination('../outside') !== null);
  });
});
