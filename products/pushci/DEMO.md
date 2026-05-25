# PushCI 60-Second Demo Script

A reproducible demo that any developer can run to see PushCI detect a real
project and run a CI pipeline locally — zero config, zero cost.

---

## Setup (once)

```bash
# Option A: Install globally
npm i -g pushci

# Option B: No install needed — use npx
npx pushci init
```

**Requirements:** git, Node >= 18 (or any supported language runtime)

---

## The Demo

Run this live in front of anyone:

```bash
# Clone a real project with real tests
git clone https://github.com/expressjs/express /tmp/demo-express
cd /tmp/demo-express

# THE MAGIC MOMENT — zero config, detects everything
npx pushci init

# Show what was generated
cat pushci.yml

# Run the pipeline on your laptop
pushci run
```

### Expected output

```
Detected: Node.js / Express
Generated: pushci.yml

Running pipeline...

  install     npm ci                         ✓  3.1s
  lint        npm run lint                   ✓  1.2s
  test        npm test                       ✓  4.8s

Pipeline passed in 9.1s
```

---

## Comparison Talking Point

> "GitHub Actions would need you to write a .github/workflows/ci.yml file
> with 30+ lines of YAML, push it to GitHub, wait for a runner to queue,
> and pay $0.008/minute. This ran on your laptop in 4 seconds. For free."

---

## Variations for Different Audiences

### Go developer

```bash
git clone https://github.com/gin-gonic/gin /tmp/demo-gin
cd /tmp/demo-gin
npx pushci init
pushci run
# Detects: Go module, runs go test ./...
```

### Python developer

```bash
git clone https://github.com/pallets/flask /tmp/demo-flask
cd /tmp/demo-flask
npx pushci init
pushci run
# Detects: Python / Flask, runs pytest
```

### Java developer (Maven)

```bash
git clone https://github.com/spring-projects/spring-petclinic /tmp/demo-petclinic
cd /tmp/demo-petclinic
npx pushci init
pushci run
# Detects: Java / Maven, runs mvn test
```

---

## What to Show If Something Goes Wrong

### If pushci run fails

```bash
pushci diagnose
# AI analyzes the failure, shows root cause + fix suggestion
```

### If the wrong stack is detected

```bash
pushci init --force
# Interactive mode — override language, framework, test command
```

### If you need to see verbose output

```bash
pushci run --verbose
# Shows every command, full stdout/stderr per step
```

---

## One-liner for the terminal skeptic

```bash
npx pushci init && pushci run
```

That is the entire workflow. No account. No YAML. No cloud. No bill.

pushci.dev
