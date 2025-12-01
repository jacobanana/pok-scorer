// ============================================
// STORAGE SERVICE TESTS
// ============================================

import { StorageService } from '../../js/utils/storage-service.js';

const { assert } = window;
const runner = window.testRunner;

runner.describe('StorageService - Save and Load', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should save data to localStorage', () => {
            const data = { name: 'Test', value: 42 };
            const result = StorageService.save('test-key', data);

            assert.equal(result, true);
            const saved = localStorage.getItem('test-key');
            assert.notEqual(saved, null);
            assert.equal(JSON.parse(saved).name, 'Test');
            assert.equal(JSON.parse(saved).value, 42);
        });

        runner.it('should load data from localStorage', () => {
            const data = { name: 'Test', value: 42 };
            localStorage.setItem('test-key', JSON.stringify(data));

            const loaded = StorageService.load('test-key');
            assert.notEqual(loaded, null);
            assert.equal(loaded.name, 'Test');
            assert.equal(loaded.value, 42);
        });

        runner.it('should return null when loading non-existent key', () => {
            const loaded = StorageService.load('non-existent');
            assert.equal(loaded, null);
        });

        runner.it('should handle complex nested objects', () => {
            const data = {
                players: {
                    red: { name: 'Alice', score: 10 },
                    blue: { name: 'Bob', score: 8 }
                },
                rounds: [1, 2, 3],
                metadata: { version: '1.0' }
            };

            StorageService.save('complex-key', data);
            const loaded = StorageService.load('complex-key');

            assert.equal(loaded.players.red.name, 'Alice');
            assert.equal(loaded.players.blue.score, 8);
            assert.equal(loaded.rounds.length, 3);
            assert.equal(loaded.metadata.version, '1.0');
        });

        runner.it('should handle arrays', () => {
            const data = [1, 2, 3, 4, 5];
            StorageService.save('array-key', data);
            const loaded = StorageService.load('array-key');

            assert.equal(Array.isArray(loaded), true);
            assert.equal(loaded.length, 5);
            assert.equal(loaded[0], 1);
            assert.equal(loaded[4], 5);
        });

        runner.it('should return null for invalid JSON', () => {
            // Suppress expected error logging
            const originalError = console.error;
            console.error = () => {};

            localStorage.setItem('invalid-key', 'not valid json{');
            const loaded = StorageService.load('invalid-key');
            assert.equal(loaded, null);

            // Restore console.error
            console.error = originalError;
        });
    });

    runner.describe('StorageService - Remove', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should remove data from localStorage', () => {
            StorageService.save('test-key', { value: 123 });
            assert.notEqual(localStorage.getItem('test-key'), null);

            const result = StorageService.remove('test-key');
            assert.equal(result, true);
            assert.equal(localStorage.getItem('test-key'), null);
        });

        runner.it('should handle removing non-existent key', () => {
            const result = StorageService.remove('non-existent');
            assert.equal(result, true);
        });
    });

    runner.describe('StorageService - Exists', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should return true for existing key', () => {
            StorageService.save('test-key', { value: 123 });
            assert.equal(StorageService.exists('test-key'), true);
        });

        runner.it('should return false for non-existent key', () => {
            assert.equal(StorageService.exists('non-existent'), false);
        });

        runner.it('should return false after removal', () => {
            StorageService.save('test-key', { value: 123 });
            assert.equal(StorageService.exists('test-key'), true);

            StorageService.remove('test-key');
            assert.equal(StorageService.exists('test-key'), false);
        });
    });

    runner.describe('StorageService - GetRaw', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should get raw string value without parsing', () => {
            const data = { name: 'Test' };
            StorageService.save('test-key', data);

            const raw = StorageService.getRaw('test-key');
            assert.equal(typeof raw, 'string');
            assert.equal(raw, '{"name":"Test"}');
        });

        runner.it('should return null for non-existent key', () => {
            const raw = StorageService.getRaw('non-existent');
            assert.equal(raw, null);
        });
    });

    runner.describe('StorageService - Clear', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should clear all localStorage data', () => {
            StorageService.save('key1', { value: 1 });
            StorageService.save('key2', { value: 2 });
            StorageService.save('key3', { value: 3 });

            assert.equal(StorageService.exists('key1'), true);
            assert.equal(StorageService.exists('key2'), true);
            assert.equal(StorageService.exists('key3'), true);

            StorageService.clear();

            assert.equal(StorageService.exists('key1'), false);
            assert.equal(StorageService.exists('key2'), false);
            assert.equal(StorageService.exists('key3'), false);
        });
    });

    runner.describe('StorageService - Edge Cases', () => {
        runner.beforeEach(() => {
            localStorage.clear();
        });

        runner.it('should handle null values', () => {
            StorageService.save('null-key', null);
            const loaded = StorageService.load('null-key');
            assert.equal(loaded, null);
        });

        runner.it('should handle undefined as null', () => {
            // Suppress expected error logging
            const originalError = console.error;
            console.error = () => {};

            StorageService.save('undefined-key', undefined);
            const loaded = StorageService.load('undefined-key');
            assert.equal(loaded, null);

            // Restore console.error
            console.error = originalError;
        });

        runner.it('should handle empty string', () => {
            StorageService.save('empty-key', '');
            const loaded = StorageService.load('empty-key');
            assert.equal(loaded, '');
        });

        runner.it('should handle empty object', () => {
            StorageService.save('empty-obj-key', {});
            const loaded = StorageService.load('empty-obj-key');
            assert.equal(typeof loaded, 'object');
            assert.equal(Object.keys(loaded).length, 0);
        });

        runner.it('should handle empty array', () => {
            StorageService.save('empty-array-key', []);
            const loaded = StorageService.load('empty-array-key');
            assert.equal(Array.isArray(loaded), true);
            assert.equal(loaded.length, 0);
        });

        runner.it('should handle boolean values', () => {
            StorageService.save('bool-true', true);
            StorageService.save('bool-false', false);

            assert.equal(StorageService.load('bool-true'), true);
            assert.equal(StorageService.load('bool-false'), false);
        });

        runner.it('should handle number values', () => {
            StorageService.save('number-key', 42.5);
            const loaded = StorageService.load('number-key');
            assert.equal(loaded, 42.5);
        });
    });
