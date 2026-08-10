import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse } from "graphql";
import type {
  DefineContractOptions,
  GraphQLContract,
  PublishContractOptions,
} from "./types";

function createErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, "cause", { value: cause });
  return error;
}

export function defineContract(opts: DefineContractOptions): GraphQLContract {
  if (!opts.consumer || typeof opts.consumer !== "string") {
    throw new Error("consumer name is required");
  }
  if (!opts.provider || typeof opts.provider !== "string") {
    throw new Error("provider name is required");
  }
  if (!Array.isArray(opts.operations) || opts.operations.length === 0) {
    throw new Error("at least one operation is required");
  }

  // Validate each operation is syntactically valid GraphQL
  for (const op of opts.operations) {
    try {
      parse(op);
    } catch (err) {
      throw createErrorWithCause(
        `Invalid GraphQL operation: ${(err as Error).message}\nOperation: ${op}`,
        err
      );
    }
  }

  return {
    consumer: opts.consumer,
    createdAt: new Date().toISOString(),
    operations: opts.operations,
    provider: opts.provider,
  };
}

export async function publishContract(
  contract: GraphQLContract,
  opts: PublishContractOptions
): Promise<void> {
  const dir = dirname(opts.outputPath);
  await mkdir(dir, { recursive: true });
  await writeFile(opts.outputPath, JSON.stringify(contract, null, 2), "utf-8");
}
