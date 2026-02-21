import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GraphQLSchema } from 'graphql';
import { GraphQLContract, ContractViolation, VerifyContractsOptions, VerifyContractsResult } from './types';
import { checkOperationCompatibility } from './matchers';

export async function verifyContracts(opts: VerifyContractsOptions): Promise<VerifyContractsResult> {
  const { schema, contractsPath } = opts;
  const violations: ContractViolation[] = [];

  let files: string[];
  try {
    const entries = await readdir(contractsPath);
    files = entries.filter((f) => f.endsWith('.json'));
  } catch (err) {
    throw new Error(`Failed to read contracts directory: ${(err as Error).message}`);
  }

  if (files.length === 0) {
    return { passed: true, violations: [] };
  }

  for (const file of files) {
    const filePath = join(contractsPath, file);
    const raw = await readFile(filePath, 'utf-8');

    let contract: GraphQLContract;
    try {
      contract = JSON.parse(raw) as GraphQLContract;
    } catch {
      violations.push({
        field: '',
        operation: '',
        reason: `Failed to parse contract file: ${file}`,
      });
      continue;
    }

    if (!contract.operations || !Array.isArray(contract.operations)) {
      violations.push({
        field: '',
        operation: '',
        reason: `Contract file "${file}" has no operations array`,
      });
      continue;
    }

    for (const operation of contract.operations) {
      const opViolations = checkOperationCompatibility(operation, schema);
      violations.push(...opViolations);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
