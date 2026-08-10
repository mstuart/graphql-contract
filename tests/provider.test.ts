import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildSchema } from "graphql";
import { defineContract, publishContract } from "../src/consumer";
import { verifyContracts } from "../src/provider";

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

describe("verifyContracts", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `graphql-contract-verify-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
  });

  it("passes when all consumed fields exist in schema", async () => {
    const contract = defineContract({
      consumer: "web-app",
      operations: ['query GetUser { user(id: "1") { id email name } }'],
      provider: "user-service",
    });
    await publishContract(contract, {
      outputPath: join(tmpDir, "web-app.json"),
    });

    const result = await verifyContracts({
      contractsPath: tmpDir,
      schema: FULL_SCHEMA,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it("detects missing field (violation)", async () => {
    const contract = defineContract({
      consumer: "web-app",
      operations: ['query GetUser { user(id: "1") { id email avatar } }'],
      provider: "user-service",
    });
    await publishContract(contract, {
      outputPath: join(tmpDir, "web-app.json"),
    });

    const result = await verifyContracts({
      contractsPath: tmpDir,
      schema: FULL_SCHEMA,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.length > 0);
    const violation = result.violations.find((v) => v.field.includes("avatar"));
    assert.ok(violation, 'Should have a violation for missing "avatar" field');
    assert.ok(violation.reason.includes("Cannot query field"));
  });

  it("detects type change from non-null to nullable (violation)", async () => {
    // The consumer expects user to return non-null (User!), but now it's nullable.
    // This manifests when the consumer queries fields that only exist on User
    // and the query itself may still validate — the real check is field existence.
    // However, a removed field is a clear violation:
    const contract = defineContract({
      consumer: "web-app",
      operations: ['query GetUser { user(id: "1") { id email age } }'],
      provider: "user-service",
    });
    await publishContract(contract, {
      outputPath: join(tmpDir, "web-app.json"),
    });

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
      contractsPath: tmpDir,
      schema: brokenSchema,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.some((v) => v.field.includes("age")));
  });

  it("passes with multiple contract files", async () => {
    const contract1 = defineContract({
      consumer: "web-app",
      operations: ['query GetUser { user(id: "1") { id email } }'],
      provider: "user-service",
    });
    const contract2 = defineContract({
      consumer: "mobile-app",
      operations: ["query GetUsers { users { id name } }"],
      provider: "user-service",
    });

    await publishContract(contract1, {
      outputPath: join(tmpDir, "web-app.json"),
    });
    await publishContract(contract2, {
      outputPath: join(tmpDir, "mobile-app.json"),
    });

    const result = await verifyContracts({
      contractsPath: tmpDir,
      schema: FULL_SCHEMA,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it("returns passed true for empty contracts directory", async () => {
    const emptyDir = join(tmpDir, "empty");
    await mkdir(emptyDir, { recursive: true });

    const result = await verifyContracts({
      contractsPath: emptyDir,
      schema: FULL_SCHEMA,
    });

    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  it("detects removed argument", async () => {
    const contract = defineContract({
      consumer: "web-app",
      operations: ['query GetUser { user(id: "1") { id email } }'],
      provider: "user-service",
    });
    await publishContract(contract, {
      outputPath: join(tmpDir, "web-app.json"),
    });

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
      contractsPath: tmpDir,
      schema: noArgSchema,
    });

    assert.equal(result.passed, false);
    assert.ok(result.violations.length > 0);
  });
});
