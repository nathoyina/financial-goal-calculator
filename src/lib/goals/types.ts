/**
 * A savings goal the app can plan.
 *
 * Retirement is the only goal in v1. A later lump-sum goal (house deposit,
 * emergency fund) should add a `GoalKind`, a pure calculator, a registry
 * entry, and a UI of its own. It should not change the retirement maths.
 */
export type GoalKind = "retirement";

export interface SavingsGoal<TInput, TResult> {
  kind: GoalKind;
  name: string;
  description: string;
  calculate: (input: TInput) => TResult;
}
