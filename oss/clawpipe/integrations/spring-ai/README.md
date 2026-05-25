# clawpipe-spring-ai

Spring AI integration for [ClawPipe](https://clawpipe.ai) — the intelligent LLM cost optimization pipeline.

ClawPipe sits between your app and LLM providers, applying boosting, context packing, prompt caching, and smart routing on every call. Per-bucket cost-reduction range pending public measured benchmark at github.com/finsavvyai/clawpipe-booster-benchmark. Pipeline mechanics:  automatic boosting, context packing, prompt caching, and smart routing.

## Installation

Add to your `pom.xml`:

```xml
<dependency>
  <groupId>ai.clawpipe</groupId>
  <artifactId>clawpipe-spring-ai</artifactId>
  <version>0.1.0</version>
</dependency>
```

Add the Spring Milestones repository (required for `spring-ai-core`):

```xml
<repositories>
  <repository>
    <id>spring-milestones</id>
    <url>https://repo.spring.io/milestone</url>
  </repository>
</repositories>
```

## Quick Start

### 1. Configure your API key

```yaml
# application.yml
clawpipe:
  api-key: cp_xxx
```

### 2. Inject and use

```java
@Service
public class MyService {

    @Autowired
    ClawPipeChatModel chatModel;

    public String ask(String question) {
        ChatResponse response = chatModel.call(new Prompt(question));
        return response.getResult().getOutput().getContent();
    }
}
```

Or construct manually:

```java
ClawPipeProperties props = new ClawPipeProperties();
props.setApiKey("cp_xxx");

ClawPipeChatModel model = new ClawPipeChatModel(props);
ChatResponse response = model.call(new Prompt("Explain recursion in one sentence"));
String text = response.getResult().getOutput().getContent();
```

## Configuration

All properties are under the `clawpipe` prefix:

| Property                    | Default                    | Description                                |
|-----------------------------|----------------------------|--------------------------------------------|
| `clawpipe.api-key`          | (required)                 | Your ClawPipe API key (`cp_xxx`)           |
| `clawpipe.gateway-url`      | `https://api.clawpipe.ai` | ClawPipe gateway base URL                  |
| `clawpipe.default-model`    | `auto`                     | Model hint — `auto` lets ClawPipe choose   |
| `clawpipe.default-provider` | `openai`                   | Provider hint for routing                  |
| `clawpipe.timeout-seconds`  | `120`                      | HTTP read timeout                          |
| `clawpipe.enable-booster`   | `true`                     | Enable deterministic transform stage       |
| `clawpipe.enable-cache`     | `true`                     | Enable prompt deduplication cache          |

Full example:

```yaml
clawpipe:
  api-key: cp_xxx
  gateway-url: https://api.clawpipe.ai
  default-model: auto
  default-provider: openai
  timeout-seconds: 120
  enable-booster: true
  enable-cache: true
```

## How It Works

Every `Prompt` is sent to `POST https://api.clawpipe.ai/v1/prompt`. The gateway runs the full pipeline:

1. **Booster** — deterministic rules resolve simple prompts instantly at zero cost
2. **Packer** — compresses context to reduce token count
3. **Cache** — returns cached responses for repeated prompts
4. **Router** — picks the cheapest model that meets quality requirements
5. **Provider** — calls OpenAI, Anthropic, Groq, etc.
6. **Learner** — tracks outcomes to improve future routing decisions

## Spring Boot Auto-Configuration

`ClawPipeAutoConfiguration` registers `ClawPipeChatModel` as a Spring bean when `clawpipe.api-key` is set. No `@Bean` method is required in your application.

To disable auto-configuration:

```yaml
spring:
  autoconfigure:
    exclude: ai.clawpipe.springai.ClawPipeAutoConfiguration
```

## License

MIT
