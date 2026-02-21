export interface GraphQLContract {
  consumer: string;
  provider: string;
  operations: string[];
  createdAt: string;
}

export interface ContractViolation {
  field: string;
  operation: string;
  reason: string;
}

export interface DefineContractOptions {
  consumer: string;
  provider: string;
  operations: string[];
}

export interface PublishContractOptions {
  outputPath: string;
}

export interface VerifyContractsOptions {
  schema: import('graphql').GraphQLSchema;
  contractsPath: string;
}

export interface VerifyContractsResult {
  passed: boolean;
  violations: ContractViolation[];
}
