export interface GraphQLContract {
  consumer: string;
  createdAt: string;
  operations: string[];
  provider: string;
}

export interface ContractViolation {
  field: string;
  operation: string;
  reason: string;
}

export interface DefineContractOptions {
  consumer: string;
  operations: string[];
  provider: string;
}

export interface PublishContractOptions {
  outputPath: string;
}

export interface VerifyContractsOptions {
  contractsPath: string;
  schema: import("graphql").GraphQLSchema;
}

export interface VerifyContractsResult {
  passed: boolean;
  violations: ContractViolation[];
}
