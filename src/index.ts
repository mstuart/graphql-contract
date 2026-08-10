// biome-ignore lint/performance/noBarrelFile: This is the package's public API entry point.
export { defineContract, publishContract } from "./consumer";
export { checkOperationCompatibility } from "./matchers";
export { verifyContracts } from "./provider";
export type {
  ContractViolation,
  DefineContractOptions,
  GraphQLContract,
  PublishContractOptions,
  VerifyContractsOptions,
  VerifyContractsResult,
} from "./types";
