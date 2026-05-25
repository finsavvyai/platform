# Git Branching Strategy for QuantumBeam.io

This document outlines the Git branching strategy used for the QuantumBeam.io project.

## Overview

We follow a GitFlow-inspired branching strategy with adaptations for our CI/CD pipeline.

## Main Branches

### `main`
- Represents the production-ready code
- All commits to `main` are tagged with version numbers
- Direct commits are not allowed
- Must pass all tests and security scans before merge

### `develop`
- Integration branch for features
- Represents the next release
- All feature branches merge into `develop`
- Continuous integration runs on every push

## Supporting Branches

### Feature Branches
- Naming convention: `feature/<ticket-number>-<short-description>`
- Example: `feature/123-add-quantum-encryption`
- Branch from: `develop`
- Merge into: `develop`
- Never push directly to `main` or `develop`

### Release Branches
- Naming convention: `release/v<major>.<minor>`
- Example: `release/v1.2.0`
- Branch from: `develop`
- Merge into: `main` AND `develop`
- Used for release preparation and bug fixes

### Hotfix Branches
- Naming convention: `hotfix/<ticket-number>-<description>`
- Example: `hotfix/456-fix-critical-security-vulnerability`
- Branch from: `main`
- Merge into: `main` AND `develop`
- Used for critical production fixes

### Bugfix Branches
- Naming convention: `bugfix/<ticket-number>-<description>`
- Example: `bugfix/789-fix-memory-leak`
- Branch from: `develop`
- Merge into: `develop`

## Branch Protection Rules

### `main` Branch
- Require pull request reviews (2 reviewers)
- Require status checks to pass:
  - CI/CD Pipeline
  - Security Scan
  - Code Coverage (>80%)
  - Integration Tests
- Restrict force pushes
- Include administrators

### `develop` Branch
- Require pull request reviews (1 reviewer)
- Require status checks to pass:
  - CI/CD Pipeline
  - Security Scan
  - Code Coverage (>75%)
- Restrict force pushes

## Workflow

### Feature Development
1. Create feature branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/123-add-quantum-encryption
   ```

2. Work on feature and commit
   ```bash
   git add .
   git commit -m "feat: add quantum encryption module"
   git push origin feature/123-add-quantum-encryption
   ```

3. Create pull request to `develop`
4. Address review feedback
5. Merge after approval and CI passes

### Release Process
1. Create release branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   ```

2. Update version numbers and changelog
3. Fix any release-blocking bugs
4. Merge to `main` and tag
   ```bash
   git checkout main
   git pull origin main
   git merge release/v1.2.0
   git tag v1.2.0
   ```

5. Merge back to `develop`
   ```bash
   git checkout develop
   git merge release/v1.2.0
   ```

### Hotfix Process
1. Create hotfix branch from `main`
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/456-fix-security-vulnerability
   ```

2. Fix the issue
3. Test thoroughly
4. Merge to `main` and tag new version
5. Merge back to `develop`

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `security`: Security-related changes

### Examples
```
feat(fraud): add quantum machine learning detection algorithm

- Implement QAOA optimization
- Add circuit encoding module
- Update fraud detection endpoints

Closes #123
```

```
fix(auth): resolve JWT token expiration issue

Fixes issue where tokens were expiring 5 minutes early
due to server time synchronization.
```

## Pre-commit Hooks

Our pre-commit hooks enforce:
- Go code formatting (gofmt, goimports)
- Linting (golangci-lint)
- Security scanning (gosec)
- Unit tests execution
- Commit message validation

## Merge Strategy

- Use **squash and merge** for feature branches to keep history clean
- Use **create merge commit** for release and hotfix branches to preserve release history

## Deleting Branches

After merging:
- Delete feature branches: `git branch -d feature/branch-name`
- Delete remote tracking: `git push origin --delete feature/branch-name`
- Keep release and hotfix branches for one release cycle for reference

## Additional Rules

1. Never commit directly to `main` or `develop`
2. Always pull latest changes before creating a new branch
3. Keep branches up-to-date with their base branch
4. Write descriptive commit messages
5. Ensure all tests pass before opening a PR
6. Review and address all PR feedback promptly
7. Use descriptive PR titles following commit message conventions

## Troubleshooting

### Common Issues

1. **Branch is behind**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/your-branch
   git rebase develop
   ```

2. **Merge conflicts during rebase**
   ```bash
   git rebase --continue  # after resolving conflicts
   git rebase --abort     # to cancel rebase
   ```

3. **Force push after rebase (use with caution)**
   ```bash
   git push --force-with-lease origin feature/your-branch
   ```

## Tools

- **GitHub** for code hosting and PR management
- **GitHub Actions** for CI/CD
- **SonarCloud** for code quality analysis
- **Dependabot** for dependency updates

## References

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)