# QueryLens API — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 35% | **Category**: BUILD

## Mission
NLP-to-SQL engine powered by GPT-4. Converts natural language questions into accurate SQL queries with confidence scoring. Built on Spring Boot 3.2 with Java 21 virtual threads for high-concurrency.

## Code Map & Index

### Directory Structure
```
querylens-api/
├── src/
│   ├── main/
│   │   ├── java/com/querylens/
│   │   │   ├── QuerylensApplication.java    # Spring Boot main
│   │   │   ├── controller/                  # REST endpoints
│   │   │   │   ├── NlpController.java      # /api/v1/nlp/query, /health
│   │   │   │   └── SchemaController.java   # /api/v1/schema
│   │   │   ├── service/                     # Business logic
│   │   │   │   ├── NlpService.java         # NL→SQL orchestration
│   │   │   │   ├── OpenAiService.java      # OpenAI API wrapper
│   │   │   │   ├── PromptService.java      # Prompt engineering
│   │   │   │   └── ValidationService.java  # SQL/semantic validation
│   │   │   ├── dto/                         # Request/response objects
│   │   │   │   ├── QueryRequest.java       # {"question": "...", "schema": "..."}
│   │   │   │   ├── QueryResponse.java      # {"sql": "...", "confidence": 0.92, "explanation": "..."}
│   │   │   │   └── ErrorResponse.java
│   │   │   ├── config/                      # Spring configuration
│   │   │   │   ├── CorsConfig.java         # CORS for QueryFlux
│   │   │   │   ├── VirtualThreadConfig.java # Virtual threads setup
│   │   │   │   └── OpenAiConfig.java       # OpenAI client factory
│   │   │   ├── model/                       # Domain entities
│   │   │   │   ├── ParsedQuery.java        # Parsed SQL query object
│   │   │   │   └── SchemaContext.java      # Database schema info
│   │   │   ├── exception/                   # Custom exceptions
│   │   │   │   ├── QueryException.java
│   │   │   │   └── ValidationException.java
│   │   │   └── util/                        # Helpers
│   │   │       ├── SqlValidator.java       # Syntax checking
│   │   │       └── PromptBuilder.java      # Construct prompts
│   │   └── resources/
│   │       ├── application.yml              # Spring Boot config
│   │       ├── application-prod.yml
│   │       └── prompts/                     # LLM prompt templates
│   │           ├── system-prompt.txt
│   │           └── few-shot-examples.json
│   └── test/
│       └── java/com/querylens/
│           ├── service/
│           │   ├── NlpServiceTest.java
│           │   └── OpenAiServiceTest.java
│           ├── controller/
│           │   └── NlpControllerTest.java
│           └── integration/
│               └── E2ETest.java
├── target/                          # Maven build output
├── pom.xml                          # Maven dependencies
├── Dockerfile                       # Container image
├── docker-compose.yml              # Local dev with OpenAI mock
└── README.md                       # Documentation
```

### Key Files Index
| File | Purpose | Language | Lines |
|------|---------|----------|-------|
| `src/main/java/com/querylens/QuerylensApplication.java` | Spring Boot entry point | Java | 40 |
| `src/main/java/com/querylens/controller/NlpController.java` | REST endpoints | Java | 60 |
| `src/main/java/com/querylens/service/NlpService.java` | Orchestration logic | Java | 120 |
| `src/main/java/com/querylens/service/OpenAiService.java` | GPT-4 integration | Java | 100 |
| `src/main/java/com/querylens/service/PromptService.java` | Prompt engineering | Java | 80 |
| `src/main/java/com/querylens/dto/QueryRequest.java` | Request DTO | Java | 30 |
| `src/main/java/com/querylens/dto/QueryResponse.java` | Response DTO | Java | 40 |
| `src/main/java/com/querylens/config/VirtualThreadConfig.java` | Thread pool setup | Java | 25 |
| `pom.xml` | Maven POM, Spring Boot 3.2, Java 21 | XML | 150 |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per class** — Split large classes into smaller services
- **Single Responsibility** — NlpService orchestrates, OpenAiService wraps API, PromptService builds prompts
- **Type Safety** — Strict Java 21, use records for immutable DTOs, sealed classes for control flow
- **Error Handling** — Checked exceptions for API calls, custom unchecked for domain logic
- **Naming** — PascalCase for classes, camelCase for methods/vars, descriptive (no abbreviations)
- **No Magic Values** — All constants in `application.yml` or dedicated Config classes
- **Dependency Injection** — Constructor injection for services, all beans Spring-managed

### Architecture Patterns

#### Request Processing Pipeline
```
1. NlpController.generateQuery(QueryRequest)
   - Validate input (question not empty, schema valid)
   - Check rate limit

2. NlpService.generateSQL(question, schema)
   - Build prompt (system + schema + few-shot examples + question)
   - Call OpenAiService.callGPT4(prompt)
   - Parse response (extract SQL, confidence)
   - Validate SQL syntax
   - Return QueryResponse

3. OpenAiService.callGPT4(prompt)
   - Send to OpenAI API (gpt-4)
   - Retry on rate limit (429)
   - Timeout after 30s
   - Parse response

4. Response to client
   - 200 OK: {"sql": "...", "confidence": 0.92, "explanation": "..."}
   - 400 Bad Request: {"error": "Invalid schema"}
   - 429 Too Many Requests: {"error": "Rate limited"}
```

#### Prompt Engineering Strategy
```
System Prompt:
"You are an expert SQL query generator. Convert natural language to SQL.
Only output valid SQL. Include confidence (0-1) as a comment."

Schema Context:
"-- Database schema:
CREATE TABLE users (id INT, email VARCHAR, created_at TIMESTAMP);
CREATE TABLE orders (id INT, user_id INT, total DECIMAL);"

Few-Shot Examples:
"Q: Show users from last 7 days
A: SELECT * FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY; -- confidence: 0.95"

User Question:
"Show me all orders over $1000"

Expected Output:
"SELECT * FROM orders WHERE total > 1000; -- confidence: 0.88"
```

#### Confidence Scoring
```java
// Parse confidence from response
// Method 1: Comment in SQL
String sql = "SELECT * FROM orders WHERE total > 1000; -- confidence: 0.88";
double confidence = extractConfidenceFromComment(sql); // 0.88

// Method 2: GPT token probability (if available from API)
// Method 3: Semantic validation score
double semanticScore = validateAgainstSchema(sql, schema);
confidence = Math.max(gptConfidence, semanticScore);
```

#### Virtual Threads for High Concurrency
```java
@Configuration
public class VirtualThreadConfig {
    @Bean
    public VirtualThreadTaskExecutor taskExecutor() {
        return new VirtualThreadTaskExecutor("querylens-");
    }
}

// Usage: Automatic via Spring when processing requests
// Each request runs in a virtual thread (low memory overhead)
// Can handle 10k+ concurrent requests on single JVM
```

### Code Review Checklist
- [ ] Class ≤ 200 lines; methods ≤ 50 lines
- [ ] All public methods have JavaDoc comments
- [ ] No raw types or wildcards (use proper generics)
- [ ] All exception cases handled explicitly
- [ ] No hardcoded API keys or URLs (use `application.yml`)
- [ ] Follows naming: PascalCase (classes), camelCase (methods)
- [ ] Use records for immutable DTOs (Java 21 feature)
- [ ] Dependency injection via constructor, not setters
- [ ] Prompts stored in files, not hardcoded strings
- [ ] Tests included for service layer (>90% coverage)

## Testing Strategy

### Unit Tests — Full Coverage Required

#### Framework
- **Framework**: JUnit 5 + Mockito + AssertJ
- **Coverage Target**: 95% lines, 90% branches
- **Run**: `mvn test` or `mvn test jacoco:report`

#### Key Tests

**NlpServiceTest.java**
```java
✅ Valid question + schema → SQL + confidence
✅ Question "Show users from last 7 days" → correct SQL
✅ Schema-aware: column names match, types correct
✅ Invalid question → error response
✅ Timeout after 30s → error response
✅ Empty schema handled gracefully
✅ Confidence between 0 and 1
```

**OpenAiServiceTest.java**
```java
✅ Mock OpenAI API call succeeds
✅ Parse response: extract SQL and confidence
✅ Retry on rate limit (429)
✅ Timeout after 30s
✅ Handle API errors (500, 403)
✅ Invalid response format → error
```

**PromptServiceTest.java**
```java
✅ System prompt includes schema
✅ Few-shot examples included
✅ User question appended correctly
✅ Prompt length reasonable (tokens < 4000)
```

**NlpControllerTest.java**
```java
✅ POST /api/v1/nlp/query with valid request → 200
✅ Invalid request → 400 with error message
✅ GET /api/v1/nlp/health → 200 {"status": "UP"}
✅ Rate limit exceeded → 429
```

**ValidationServiceTest.java**
```java
✅ Valid SQL passes validation
✅ SQL injection attempt detected
✅ Missing columns detected (if schema provided)
✅ Type mismatches detected
✅ SQL syntax errors reported
```

### Integration Tests
```java
// Test full flow with real OpenAI (use API key from env)
@SpringBootTest
class E2ETest {
    ✅ "Show users from last 7 days" → valid SQL returned
    ✅ Confidence score returned (0-1)
    ✅ Response time < 5 seconds
    ✅ Virtual threads handling concurrent requests
}
```

## Commands

### Development
```bash
# Install dependencies
mvn clean install

# Run server (port 8090)
mvn spring-boot:run

# With environment variables
export OPENAI_API_KEY=sk-xxx
mvn spring-boot:run

# Watch mode (requires IDE)
# Most IDEs auto-compile on save
```

### Testing
```bash
# Unit tests
mvn test

# Coverage report
mvn test jacoco:report
# Open target/site/jacoco/index.html

# Specific test class
mvn test -Dtest=NlpServiceTest

# Integration tests
mvn test -Dgroups=integration

# All tests with output
mvn test -X
```

### Building
```bash
# Create JAR
mvn clean package

# Skip tests
mvn clean package -DskipTests

# Build Docker image
docker build -t querylens-api:latest .

# Run Docker container
docker run -p 8090:8090 \
  -e OPENAI_API_KEY=sk-xxx \
  querylens-api:latest
```

## What's Done vs What's Left

### Completed
- Spring Boot 3.2 + Java 21 setup
- Virtual threads configuration
- REST controller scaffold
- DTO classes (QueryRequest, QueryResponse)
- Error handling framework
- Test structure (JUnit 5 + Mockito)
- Dockerfile for containerization

### In Progress
- OpenAI API integration (GPT-4 client)
- Prompt engineering (system prompt, few-shot examples)
- Confidence scoring logic
- SQL validation (syntax checking)
- Schema context parsing

### Critical Path to MVP
1. **Week 1**: OpenAI client + basic prompt → SQL generation
2. **Week 2**: Confidence scoring + response parsing
3. **Week 3**: Schema context integration + few-shot examples
4. **Week 4**: Validation + error handling + rate limiting
5. **Week 5**: Performance optimization (virtual threads, caching)
6. **Week 6**: Testing, documentation, production deployment

## Competitors & Market Context

### Similar Solutions
- **OpenAI ChatGPT**: General-purpose, no structured output
- **Anthropic Claude**: Better reasoning, similar capabilities
- **LangChain SQLDatabase**: Generic chain, not optimized
- **Text-to-SQL Fine-tuned Models**: High training cost

### QueryLens Advantages
- **Optimized for SQL**: Prompt engineering specific to databases
- **Confidence Scoring**: Know when to trust the result
- **Schema Context**: Works with actual database schema
- **High Performance**: Virtual threads handle high concurrency
- **Easy Integration**: Simple REST API (QueryFlux, MCP Server)

### Accuracy Targets
- **Simple Queries** (10-20 word NL): 95%+ accuracy
- **Complex Queries** (50+ word NL): 80%+ accuracy
- **With Schema Context**: +10-15% improvement
- **Response Time**: <2 seconds (tail: <5 seconds)

---

**QueryLens API** — *NLP→SQL with confidence scoring*
