/**
 * SmartStore OS — GraphQL Query Complexity Limiter
 *
 * Prevents expensive fan-out queries by scoring each operation and
 * rejecting requests that exceed `maxComplexity`.
 *
 * Scoring rules:
 *   - Every scalar field costs 1
 *   - Every object field costs 1 (plus children)
 *   - List fields multiply their children's cost by `listMultiplier` (default 10)
 *     to approximate the cost of fetching N records
 *
 * This catches queries like:
 *   { sales { items { product { saleItems { sale { customer { sales { ... } } } } } } } }
 * which would create an exponential DB load without this guard.
 *
 * Limits:
 *   - Anonymous/unauthenticated queries: maxComplexity = 50
 *   - Authenticated queries: maxComplexity = 500
 *   - Mutations: not scored (they have individual auth guards)
 */

import {
  GraphQLError,
  GraphQLSchema,
  type DocumentNode,
  type ValidationContext,
  type ASTVisitor,
  Kind,
  type FieldNode,
  type SelectionSetNode,
  GraphQLList,
  GraphQLNonNull,
  type GraphQLOutputType,
  type GraphQLObjectType,
  isObjectType,
  isListType,
  isNonNullType,
} from 'graphql';

/** Unwrap NonNull and List wrappers to get the named type */
function unwrap(type: GraphQLOutputType): GraphQLOutputType {
  if (isNonNullType(type) || isListType(type)) return unwrap(type.ofType as GraphQLOutputType);
  return type;
}

/** True if the output type is a list (including NonNull<List<...>>) */
function isList(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLNonNull) return isList(type.ofType as GraphQLOutputType);
  return type instanceof GraphQLList;
}

function scoreSelectionSet(
  set: SelectionSetNode | undefined,
  parentType: GraphQLOutputType | undefined,
  schema: GraphQLSchema,
  listMultiplier: number,
  depth: number,
): number {
  if (!set || depth > 20) return 0;   // safety: stop recursion if schema is cyclic
  let cost = 0;

  for (const selection of set.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const field = selection as FieldNode;
    const fieldName = field.name.value;

    // Introspection fields — cheap, always allow
    if (fieldName.startsWith('__')) continue;

    cost += 1;  // base cost per field

    if (!parentType || !isObjectType(unwrap(parentType))) {
      // Can't resolve type info — use conservative flat scoring
      cost += scoreSelectionSet(field.selectionSet, undefined, schema, listMultiplier, depth + 1);
      continue;
    }

    const objectType = unwrap(parentType) as GraphQLObjectType;
    const fieldDef = objectType.getFields()[fieldName];
    if (!fieldDef) continue;

    const childType = fieldDef.type;
    const childCost = scoreSelectionSet(
      field.selectionSet,
      childType,
      schema,
      listMultiplier,
      depth + 1,
    );

    // Multiply child cost when this field returns a list
    cost += isList(childType) ? childCost * listMultiplier : childCost;
  }

  return cost;
}

/**
 * Returns an Apollo Server validation rule that rejects operations exceeding `maxComplexity`.
 */
export function complexityLimit(maxComplexity: number, listMultiplier = 10) {
  return function complexityLimitRule(context: ValidationContext): ASTVisitor {
    return {
      OperationDefinition: {
        leave(node) {
          const schema    = context.getSchema();
          const opType    = node.operation; // 'query' | 'mutation' | 'subscription'

          // Don't score mutations — they have individual auth + rate limiting
          if (opType === 'mutation') return;

          const rootType =
            opType === 'query'        ? schema.getQueryType()        :
            opType === 'subscription' ? schema.getSubscriptionType() :
            undefined;

          const complexity = scoreSelectionSet(
            node.selectionSet,
            rootType as GraphQLOutputType | undefined,
            schema,
            listMultiplier,
            0,
          );

          if (complexity > maxComplexity) {
            context.reportError(
              new GraphQLError(
                `Query is too complex: complexity score ${complexity} exceeds the maximum of ${maxComplexity}. ` +
                `Simplify your query by requesting fewer nested fields or reducing list field usage.`,
                {
                  nodes: [node],
                  extensions: { code: 'GRAPHQL_COMPLEXITY_LIMIT', complexity, maxComplexity },
                },
              ),
            );
          }
        },
      },
    };
  };
}
