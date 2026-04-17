-- Allow 'monthly_pnl' as a valid progress goal type.
-- Used by the overview MonthlyGoalCard to track a user's monthly P&L target.

ALTER TABLE progress_goals
  DROP CONSTRAINT IF EXISTS progress_goals_goal_type_check;

ALTER TABLE progress_goals
  ADD CONSTRAINT progress_goals_goal_type_check
  CHECK (goal_type IN (
    'review_completion',
    'journal_streak',
    'max_rule_breaks',
    'profit_factor',
    'win_rate',
    'monthly_pnl'
  ));
