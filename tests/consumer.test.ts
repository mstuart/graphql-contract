import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { defineContract, publishContract } from "../src/consumer";

const INVALID_OPERATION_PATTERN = /Invalid GraphQL operation/;
const MISSING_CONSUMER_PATTERN = /consumer name is required/;
const MISSING_OPERATIONS_PATTERN = /at least one operation is required/;

describe("defineContract", () => {
  it("returns correct shape with valid inputs", () => {
    const contract = defineContract({
      consumer: "web-app",
      operations: ["query GetUser { user { id email } }"],
      provider: "user-service",
    });

    assert.equal(contract.consumer, "web-app");
    assert.equal(contract.provider, "user-service");
    assert.deepEqual(contract.operations, [
      "query GetUser { user { id email } }",
    ]);
    assert.ok(contract.createdAt);
    assert.ok(new Date(contract.createdAt).getTime() > 0);
  });

  it("accepts multiple operations", () => {
    const contract = defineContract({
      consumer: "mobile-app",
      operations: [
        "query GetUser { user { id email } }",
        "query GetUsers { users { id name } }",
      ],
      provider: "user-service",
    });

    assert.equal(contract.operations.length, 2);
  });

  it("throws on invalid GraphQL syntax", () => {
    assert.throws(
      () =>
        defineContract({
          consumer: "web-app",
          operations: ["this is not graphql {{{"],
          provider: "user-service",
        }),
      INVALID_OPERATION_PATTERN
    );
  });

  it("throws when consumer is empty", () => {
    assert.throws(
      () =>
        defineContract({
          consumer: "",
          operations: ["query GetUser { user { id } }"],
          provider: "user-service",
        }),
      MISSING_CONSUMER_PATTERN
    );
  });

  it("throws when operations is empty", () => {
    assert.throws(
      () =>
        defineContract({
          consumer: "web-app",
          operations: [],
          provider: "user-service",
        }),
      MISSING_OPERATIONS_PATTERN
    );
  });
});

describe("publishContract", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `graphql-contract-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
  });

  it("writes valid JSON file", async () => {
    const contract = defineContract({
      consumer: "web-app",
      operations: ["query GetUser { user { id email } }"],
      provider: "user-service",
    });

    const outputPath = join(tmpDir, "contracts", "web-app.json");
    await publishContract(contract, { outputPath });

    const raw = await readFile(outputPath, "utf-8");
    const parsed = JSON.parse(raw);

    assert.equal(parsed.consumer, "web-app");
    assert.equal(parsed.provider, "user-service");
    assert.deepEqual(parsed.operations, [
      "query GetUser { user { id email } }",
    ]);
    assert.ok(parsed.createdAt);
  });
});
