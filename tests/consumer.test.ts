import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { defineContract, publishContract } from '../src/consumer';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('defineContract', () => {
  it('returns correct shape with valid inputs', () => {
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user { id email } }'],
    });

    assert.equal(contract.consumer, 'web-app');
    assert.equal(contract.provider, 'user-service');
    assert.deepEqual(contract.operations, ['query GetUser { user { id email } }']);
    assert.ok(contract.createdAt);
    assert.ok(new Date(contract.createdAt).getTime() > 0);
  });

  it('accepts multiple operations', () => {
    const contract = defineContract({
      consumer: 'mobile-app',
      provider: 'user-service',
      operations: [
        'query GetUser { user { id email } }',
        'query GetUsers { users { id name } }',
      ],
    });

    assert.equal(contract.operations.length, 2);
  });

  it('throws on invalid GraphQL syntax', () => {
    assert.throws(
      () =>
        defineContract({
          consumer: 'web-app',
          provider: 'user-service',
          operations: ['this is not graphql {{{'],
        }),
      /Invalid GraphQL operation/,
    );
  });

  it('throws when consumer is empty', () => {
    assert.throws(
      () =>
        defineContract({
          consumer: '',
          provider: 'user-service',
          operations: ['query GetUser { user { id } }'],
        }),
      /consumer name is required/,
    );
  });

  it('throws when operations is empty', () => {
    assert.throws(
      () =>
        defineContract({
          consumer: 'web-app',
          provider: 'user-service',
          operations: [],
        }),
      /at least one operation is required/,
    );
  });
});

describe('publishContract', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `graphql-contract-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes valid JSON file', async () => {
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user { id email } }'],
    });

    const outputPath = join(tmpDir, 'contracts', 'web-app.json');
    await publishContract(contract, { outputPath });

    const raw = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw);

    assert.equal(parsed.consumer, 'web-app');
    assert.equal(parsed.provider, 'user-service');
    assert.deepEqual(parsed.operations, ['query GetUser { user { id email } }']);
    assert.ok(parsed.createdAt);
  });
});
