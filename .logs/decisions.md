# Decision Log

## DEC-001

**Date:** 2026-05-06
**Agent:** Frontend Engineer
**Task:** frontend-types-fix

**Decision:** Updated test mock data in `AnnotationCard.test.tsx` and `client.test.ts` to match the new `@shirajitsu/types` type shapes, treating this as mock data alignment rather than test logic modification.

**Context:** The `@shirajitsu/types` package was updated with new field names for `TensionRating` (`score`/`sourceCount` replacing `numerator`/`denominator`) and new required fields on `AnalyzeResponse` (`failedClaims`, `sessionStats`) and `SourceResult` (`relevanceScore`, `divergenceScore`). Test files contained mock data objects typed against these interfaces that no longer matched the canonical shapes, causing TypeScript compile errors.

**Options considered:**
1. Update the mock data objects in the test files to use the new field names and add required fields — preserves all test assertions and logic, only aligns the data shape to the current type contract.
2. Escalate to Test Engineer to modify the test files — not necessary since the changes are purely to mock data values, not test assertions or test intent.

**Decision made:** Option 1. The changes are confined to mock fixture data; no assertions, test structure, or test intent was modified. The `label` field assertion (`'0 of 4 sources frame this differently'`) remains unchanged since `label` is still present in `TensionRating`.

**PM/Tech Lead review required:** No
