import { GraphQLError, type ValidationContext, type ASTVisitor } from 'graphql';

/**
 * Reject GraphQL operations whose selection-set nesting exceeds `maxDepth`.
 * Fragments and inline fragments count toward depth of their fields.
 */
export function depthLimit(maxDepth: number) {
  return function depthLimitRule(context: ValidationContext): ASTVisitor {
    const depths: number[] = [];

    function enterSelection() {
      depths.push((depths[depths.length - 1] ?? 0) + 1);
      const current = depths[depths.length - 1] ?? 0;
      if (current > maxDepth) {
        context.reportError(
          new GraphQLError(
            `Query is too nested: depth ${current} exceeds the maximum of ${maxDepth}.`,
            { extensions: { code: 'GRAPHQL_DEPTH_LIMIT' } },
          ),
        );
      }
    }

    function leaveSelection() {
      depths.pop();
    }

    return {
      Field: {
        enter: enterSelection,
        leave: leaveSelection,
      },
      InlineFragment: {
        enter: enterSelection,
        leave: leaveSelection,
      },
      FragmentDefinition: {
        enter: enterSelection,
        leave: leaveSelection,
      },
    };
  };
}
