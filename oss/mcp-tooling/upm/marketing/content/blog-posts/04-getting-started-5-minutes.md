# Getting Started with UPM in 5 Minutes

> **Hero Image**: Generate with Higgadilwld.ai using prompt: "Quick start tutorial illustration, step-by-step guide visual, clean modern design, blue and green color scheme, developer tutorial aesthetic, 5-minute guide style"

---

## Introduction

Want to start using UPM right now? This guide will have you up and running in **5 minutes**.

---

## Prerequisites

- A project in any language (Java, Python, JavaScript, etc.)
- Basic command-line knowledge
- Internet connection

That's it! Let's go.

---

## Step 1: Install UPM (1 minute)

### Option A: Via pip (Python)

```bash
pip install universal-package-manager
```

### Option B: Via npm (Node.js)

```bash
npm install -g upm
```

### Option C: Via Homebrew (macOS)

```bash
brew install upm
```

### Verify Installation

```bash
upm --version
```

You should see: `upm version 1.0.0` (or similar)

---

## Step 2: Initialize Your Project (1 minute)

Navigate to your project directory:

```bash
cd /path/to/your/project
```

Initialize UPM:

```bash
upm init
```

This creates an `upm.yml` file in your project root.

---

## Step 3: Add Your First Cross-Language Dependency (2 minutes)

### Example: Add Python's requests to a Java Project

Edit `upm.yml`:

```yaml
project: my-project
target_language: java

dependencies:
  # Your existing Java dependencies
  java:
    - "com.fasterxml.jackson.core:jackson-databind:2.15.2"
  
  # Add Python library
  python:
    - "requests:2.28.1"
```

Or use the CLI:

```bash
upm add python:requests:2.28.1
```

### Example: Add JavaScript's lodash to a Python Project

```yaml
dependencies:
  python:
    - "pandas:2.1.0"
  
  # Add JavaScript library
  javascript:
    - "lodash:4.17.21"
```

Or:

```bash
upm add javascript:lodash:4.17.21
```

---

## Step 4: Use It in Your Code (1 minute)

### Java Example

```java
import udp.bridges.python.Requests;

public class HttpClient {
    public String fetch(String url) {
        Requests requests = UPMBridge.python("requests");
        Response response = requests.get(url);
        return response.text();
    }
}
```

### Python Example

```python
from udp.bridges.javascript import lodash

# Use JavaScript's lodash in Python
result = lodash.pick(data, ['name', 'email'])
```

### JavaScript Example

```javascript
const { pandas } = require('udp/bridges/python');

// Use Python's pandas in JavaScript
const df = await pandas.read_csv('data.csv');
```

---

## Step 5: Build and Run (30 seconds)

### Java (Maven)

```bash
mvn clean compile
```

### Python

```bash
pip install -r requirements.txt
upm install
```

### JavaScript

```bash
npm install
upm install
```

---

## That's It! 🎉

You're now using cross-language dependencies with UPM!

---

## Quick Examples

### Use Python's pandas in Java

```java
import udp.bridges.python.Pandas;

Pandas pd = UPMBridge.python("pandas");
DataFrame df = pd.read_csv("data.csv");
```

### Use Rust's serde in Python

```python
from udp.bridges.rust import serde

data = serde.json.from_str(json_string)
```

### Use JavaScript's axios in Java

```java
import udp.bridges.javascript.Axios;

Axios axios = UPMBridge.javascript("axios");
Response response = axios.get("https://api.example.com");
```

---

## Next Steps

1. **Explore**: Try different language combinations
2. **Read Docs**: Check out [upmplus.dev/docs](https://upmplus.dev/docs)
3. **Join Community**: Connect with other UPM users
4. **Share**: Tell us about your use cases!

---

## Common Questions

### Q: Does this work with existing projects?

**A**: Yes! UPM works alongside your existing package managers. Just add `upm.yml` and start using cross-language dependencies.

### Q: What about performance?

**A**: UPM bridges are optimized for performance. For hot paths, consider caching bridge instances.

### Q: Is it secure?

**A**: Yes! UPM includes unified security scanning across all languages and ecosystems.

### Q: What languages are supported?

**A**: Currently: Java, Python, JavaScript, Rust, Go. More coming soon!

---

## Troubleshooting

### Issue: Library not found

**Solution**: Ensure it's in your `upm.yml` and run `upm install`

### Issue: Build errors

**Solution**: Check that your target language runtime is installed (Java, Python, Node.js, etc.)

### Issue: Permission errors

**Solution**: Use `sudo` if needed, or install in user directory

---

## Resources

- **Documentation**: [upmplus.dev/docs](https://upmplus.dev/docs)
- **Examples**: [upmplus.dev/examples](https://upmplus.dev/examples)
- **Community**: [Discord/Slack link]
- **GitHub**: [Your GitHub repo]

---

## Conclusion

In just 5 minutes, you've:
- ✅ Installed UPM
- ✅ Initialized your project
- ✅ Added cross-language dependencies
- ✅ Used them in your code

**That's the power of UPM!** Start using the best libraries from any language today.

Visit [upmplus.dev](https://upmplus.dev) to learn more.

---

**Tags**: #UPM #Tutorial #QuickStart #DeveloperTools #GettingStarted

**Author**: UPM Team  
**Published**: [Date]  
**Last Updated**: [Date]
