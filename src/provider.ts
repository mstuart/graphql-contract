import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkOperationCompatibility } from "./matchers";
import type {
  ContractViolation,
  GraphQLContract,
  VerifyContractsOptions,
  VerifyContractsResult,
} from "./types";

function createErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, "cause", { value: cause });
  return error;
}

export async function verifyContracts(
  opts: VerifyContractsOptions
): Promise<VerifyContractsResult> {
  const { schema, contractsPath } = opts;
  const violations: ContractViolation[] = [];

  let files: string[];
  try {
    const entries = await readdir(contractsPath);
    files = entries.filter((f) => f.endsWith(".json"));
  } catch (err) {
    throw createErrorWithCause(
      `Failed to read contracts directory: ${(err as Error).message}`,
      err
    );
  }

  if (files.length === 0) {
    return { passed: true, violations: [] };
  }

  const violationGroups = await Promise.all(
    files.map(async (file) => {
      const fileViolations: ContractViolation[] = [];
      const filePath = join(contractsPath, file);
      const raw = await readFile(filePath, "utf-8");

      let contract: Partial<GraphQLContract>;
      try {
        contract = JSON.parse(raw) as Partial<GraphQLContract>;
      } catch {
        fileViolations.push({
          field: "",
          operation: "",
          reason: `Failed to parse contract file: ${file}`,
        });
        return fileViolations;
      }

      if (!Array.isArray(contract.operations)) {
        fileViolations.push({
          field: "",
          operation: "",
          reason: `Contract file "${file}" has no operations array`,
        });
        return fileViolations;
      }

      for (const operation of contract.operations) {
        const opViolations = checkOperationCompatibility(operation, schema);
        fileViolations.push(...opViolations);
      }
      return fileViolations;
    })
  );
  violations.push(...violationGroups.flat());

  return {
    passed: violations.length === 0,
    violations,
  };
}
