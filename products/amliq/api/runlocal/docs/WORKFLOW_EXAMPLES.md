# PushCI Workflow Examples

## 1. Node.js Application

```yaml
name: Node CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: [linux, node]
    steps:
      - run: npm ci && npm run lint
  test:
    runs-on: [linux, node]
    steps:
      - cache: { key: node-${{ hashFiles('package-lock.json') }}, paths: [node_modules] }
      - run: npm ci && npm test -- --coverage
      - artifacts: { upload: coverage/, name: coverage-report }
  build:
    needs: [lint, test]
    steps:
      - run: npm ci && npm run build
```

## 2. Python FastAPI

```yaml
name: FastAPI CI
on: [push]
jobs:
  test:
    runs-on: [linux, python]
    env: { DATABASE_URL: "postgres://localhost:5432/testdb" }
    steps:
      - run: pip install -r requirements.txt
      - run: pytest --cov=app tests/
  docker:
    needs: test
    runs-on: [linux, docker]
    steps:
      - run: docker build -t myapp:${{ sha }} . && docker push registry.example.com/myapp:${{ sha }}
        secrets: [REGISTRY_PASS]
```

## 3. Java Maven

```yaml
name: Java CI
on: [push, pull_request]
jobs:
  build:
    runs-on: [linux, java]
    steps:
      - cache: { key: maven-${{ hashFiles('pom.xml') }}, paths: [~/.m2/repository] }
      - run: mvn compile && mvn test && mvn package -DskipTests
      - artifacts: { upload: target/*.jar, name: app-jar }
```

## 4. Docker Build and Push

```yaml
name: Docker Publish
on: { push: { branches: [main] } }
jobs:
  build-push:
    runs-on: [linux, docker]
    steps:
      - run: |
          docker build -t registry.example.com/app:${{ sha }} .
          docker tag registry.example.com/app:${{ sha }} registry.example.com/app:latest
      - run: |
          echo $REGISTRY_PASS | docker login registry.example.com -u $REGISTRY_USER --password-stdin
          docker push registry.example.com/app:${{ sha }}
          docker push registry.example.com/app:latest
        secrets: [REGISTRY_USER, REGISTRY_PASS]
```

## 5. Full Deploy Pipeline

```yaml
name: Deploy Pipeline
on: { push: { branches: [main] } }
jobs:
  test:
    runs-on: [linux, node]
    steps:
      - run: npm ci && npm test
  staging:
    needs: test
    environment: { name: staging }
    runs-on: [linux, node]
    steps:
      - run: npm run build && ./scripts/deploy.sh staging
        secrets: [DEPLOY_KEY]
  production:
    needs: staging
    environment: { name: production, approvers: [team-leads] }
    steps:
      - run: npm run build && ./scripts/deploy.sh production
        secrets: [DEPLOY_KEY, PROD_DB_URL]
```