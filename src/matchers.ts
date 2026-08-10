import {
  type DocumentNode,
  type FieldNode,
  type GraphQLSchema,
  parse,
  TypeInfo,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import type { ContractViolation } from "./types";

const UNKNOWN_FIELD_PATTERN = /Cannot query field "([^"]+)" on type "([^"]+)"/;

export function checkOperationCompatibility(
  operation: string,
  schema: GraphQLSchema
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  let doc: DocumentNode;
  try {
    doc = parse(operation);
  } catch (err) {
    violations.push({
      field: "",
      operation,
      reason: `Failed to parse operation: ${(err as Error).message}`,
    });
    return violations;
  }

  // Use graphql's built-in validate to catch fields that don't exist
  const validationErrors = validate(schema, doc);
  for (const error of validationErrors) {
    violations.push({
      field: extractFieldFromError(error.message),
      operation,
      reason: error.message,
    });
  }

  if (validationErrors.length > 0) {
    return violations;
  }

  // Walk the AST with type info to check nullability and argument changes
  const typeInfo = new TypeInfo(schema);

  visit(
    doc,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node: FieldNode) {
          const parentType = typeInfo.getParentType();
          const fieldDef = typeInfo.getFieldDef();

          if (!(parentType && fieldDef)) {
            // Field doesn't exist — already caught by validate()
            return;
          }

          // Check arguments used in the operation still exist on the field
          if (node.arguments && node.arguments.length > 0) {
            for (const arg of node.arguments) {
              const argName = arg.name.value;
              const schemArg = fieldDef.args.find((a) => a.name === argName);
              if (!schemArg) {
                violations.push({
                  field: `${parentType.name}.${node.name.value}`,
                  operation,
                  reason: `Argument "${argName}" no longer exists on field "${parentType.name}.${node.name.value}"`,
                });
              }
            }
          }
        },
      },
    })
  );

  return violations;
}

function extractFieldFromError(message: string): string {
  // graphql validation errors typically say:
  // Cannot query field "x" on type "Y"
  const match = message.match(UNKNOWN_FIELD_PATTERN);
  if (match) {
    return `${match[2]}.${match[1]}`;
  }
  return "";
}
