# QuantumBeam.io Git Repository Configuration

## Branch Strategy

This repository uses GitFlow branching model with the following structure:

### Primary Branches
- **main**: Production-ready code, only accepts merge requests from `develop` and `hotfix/*`
- **develop**: Integration branch for features, only accepts merge requests from `feature/*` and `release/*`

### Supporting Branches
- **feature/***: Feature development branches, branched from `develop`, merged back to `develop`
- **release/***: Release preparation branches, branched from `develop`, merged to `main` and `develop`
- **hotfix/***: Emergency fixes, branched from `main`, merged to `main` and `develop`

## Branch Protection Rules

### main branch
- Require pull request reviews before merging (2 reviewers)
- Require status checks to pass before merging
- Include administrators as reviewers
- Restrict pushes that create files
- Require linear history

### develop branch
- Require pull request reviews before merging (1 reviewer)
- Require status checks to pass before merging
- Include administrators as reviewers
- Restrict pushes that create files

## Workflow

1. **Feature Development**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/new-feature-name
   # ... work on feature ...
   git push origin feature/new-feature-name
   # Create pull request to develop
   ```

2. **Release Preparation**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.0.0
   # ... prepare release ...
   git push origin release/v1.0.0
   # Create pull request to main and develop
   ```

3. **Hotfix**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-fix
   # ... fix issue ...
   git push origin hotfix/critical-fix
   # Create pull request to main and develop
   ```

## Commit Message Format

Use conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
- `feat(api): add transaction fraud detection endpoint`
- `fix(quantum): resolve circuit optimization issue`
- `docs(readme): update installation instructions`