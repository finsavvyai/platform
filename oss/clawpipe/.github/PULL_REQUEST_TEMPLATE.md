## Summary

Brief description of the changes and the problem they solve.

## Type of Change

- [ ] Bug fix (`fix(scope): ...`)
- [ ] New feature (`feat(scope): ...`)
- [ ] Refactoring (`refactor(scope): ...`)
- [ ] Documentation (`docs: ...`)
- [ ] CI/CD (`chore: ...`)

## Changes

- ...
- ...

## Test Plan

- [ ] Unit tests added / updated
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Tested manually — describe steps:

  ```
  # e.g.
  cd sdk && npm test
  ```

## Checklist

- [ ] All tests pass: `cd sdk && npm test`
- [ ] No source file in `sdk/src/` exceeds 200 lines (`find sdk/src -name "*.ts" -not -name "*.test.ts" -exec wc -l {} \; | sort -n`)
- [ ] Coverage thresholds met (>=90% line, >=85% branch; 100% for auth/security paths)
- [ ] No secrets, API keys, or credentials committed
- [ ] No TODO/FIXME without a linked tracked issue
- [ ] Documentation updated (README, CHANGELOG, JSDoc) where behaviour changed
- [ ] Commit message follows `feat(scope): message` / `fix(scope): message` convention

## Related Issues

Closes #
