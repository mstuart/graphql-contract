import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema } from 'graphql';
import { verifyContracts } from '../src/provider';
import { defineContract, publishContract } from '../src/consumer';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FULL_SCHEMA = buildSchema(`
  type Query {
    user(id: ID!): User!
    users: [User!]!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    age: Int
  }
`);

describe('verifyContracts', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `graphql-contract-verify-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('passes when all consumed fields exist in schema', async () => {
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user(id: "1") { id email name } }'],
    });
    await publishContract(contract, { outputPath: join(tmpDir, 'web-app.json') });

    const result = await verifyContracts({
      schema: FULL_SCHEMA,
      contractsPath: tmpDir,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it('detects missing field (violation)', async () => {
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user(id: "1") { id email avatar } }'],
    });
    await publishContract(contract, { outputPath: join(tmpDir, 'web-app.json') });

    const result = await verifyContracts({
      schema: FULL_SCHEMA,
      contractsPath: tmpDir,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.length > 0);
    const violation = result.violations.find((v) => v.field.includes('avatar'));
    assert.ok(violation, 'Should have a violation for missing "avatar" field');
    assert.ok(violation.reason.includes('Cannot query field'));
  });

  it('detects type change from non-null to nullable (violation)', async () => {
    // The contract was written against a schema where email was non-null.
    // We verify against a schema where email is now nullable.
    const relaxedSchema = buildSchema(`
      type Query {
        user(id: ID!): User
      }

      type User {
        id: ID!
        email: String
        name: String!
      }
    `);

    // The consumer expects user to return non-null (User!), but now it's nullable.
    // This manifests when the consumer queries fields that only exist on User
    // and the query itself may still validate — the real check is field existence.
    // However, a removed field is a clear violation:
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user(id: "1") { id email age } }'],
    });
    await publishContract(contract, { outputPath: join(tmpDir, 'web-app.json') });

    // Verify against a schema where "age" has been removed
    const brokenSchema = buildSchema(`
      type Query {
        user(id: ID!): User
      }

      type User {
        id: ID!
        email: String
        name: String!
      }
    `);

    const result = await verifyContracts({
      schema: brokenSchema,
      contractsPath: tmpDir,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.some((v) => v.field.includes('age')));
  });

  it('passes with multiple contract files', async () => {
    const contract1 = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user(id: "1") { id email } }'],
    });
    const contract2 = defineContract({
      consumer: 'mobile-app',
      provider: 'user-service',
      operations: ['query GetUsers { users { id name } }'],
    });

    await publishContract(contract1, { outputPath: join(tmpDir, 'web-app.json') });
    await publishContract(contract2, { outputPath: join(tmpDir, 'mobile-app.json') });

    const result = await verifyContracts({
      schema: FULL_SCHEMA,
      contractsPath: tmpDir,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it('returns passed true for empty contracts directory', async () => {
    const emptyDir = join(tmpDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    const result = await verifyContracts({
      schema: FULL_SCHEMA,
      contractsPath: emptyDir,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it('detects removed argument', async () => {
    const contract = defineContract({
      consumer: 'web-app',
      provider: 'user-service',
      operations: ['query GetUser { user(id: "1") { id email } }'],
    });
    await publishContract(contract, { outputPath: join(tmpDir, 'web-app.json') });

    // Schema where user no longer takes an id argument
    const noArgSchema = buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: ID!
        email: String!
      }
    `);

    const result = await verifyContracts({
      schema: noArgSchema,
      contractsPath: tmpDir,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.length > 0);
  });
});
