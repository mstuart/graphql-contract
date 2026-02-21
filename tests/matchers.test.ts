import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema } from 'graphql';
import { checkOperationCompatibility } from '../src/matchers';

const SCHEMA = buildSchema(`
  type Query {
    user(id: ID!): User!
    users(limit: Int): [User!]!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
  }
`);

describe('checkOperationCompatibility', () => {
  it('returns no violations for valid operation', () => {
    const violations = checkOperationCompatibility(
      'query GetUser { user(id: "1") { id email name } }',
      SCHEMA,
    );
    assert.equal(violations.length, 0);
  });

  it('detects field that does not exist', () => {
    const violations = checkOperationCompatibility(
      'query GetUser { user(id: "1") { id email avatar } }',
      SCHEMA,
    );
    assert.ok(violations.length > 0);
    assert.ok(violations.some((v) => v.reason.includes('avatar')));
  });

  it('detects nested field that does not exist', () => {
    const violations = checkOperationCompatibility(
      'query GetUser { user(id: "1") { id posts { id title category } } }',
      SCHEMA,
    );
    assert.ok(violations.length > 0);
    assert.ok(violations.some((v) => v.reason.includes('category')));
  });

  it('returns violation for unparseable operation', () => {
    const violations = checkOperationCompatibility('not valid graphql {{{', SCHEMA);
    assert.ok(violations.length > 0);
    assert.ok(violations.some((v) => v.reason.includes('Failed to parse')));
  });

  it('detects removed argument', () => {
    const noArgSchema = buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: ID!
        email: String!
      }
    `);

    const violations = checkOperationCompatibility(
      'query GetUser { user(id: "1") { id email } }',
      noArgSchema,
    );
    assert.ok(violations.length > 0);
  });

  it('handles valid deeply nested queries', () => {
    const violations = checkOperationCompatibility(
      'query GetUser { user(id: "1") { id posts { id title body } } }',
      SCHEMA,
    );
    assert.equal(violations.length, 0);
  });
});
