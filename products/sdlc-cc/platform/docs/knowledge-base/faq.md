# SDLC.ai Knowledge Base - Frequently Asked Questions

## Table of Contents
1. [Getting Started](#getting-started)
2. [API Questions](#api-questions)
3. [SDKs and Integration](#sdks-and-integration)
4. [Security and Compliance](#security-and-compliance)
5. [Pricing and Billing](#pricing-and-billing)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Getting Started

### Q: What is SDLC.ai?
**A:** SDLC.ai is a Secure Data Learning Platform that enables organizations to safely connect their private data with AI models. It provides enterprise-grade security, privacy controls, and compliance features while allowing you to leverage powerful AI capabilities on your sensitive data.

### Q: How quickly can I get started?
**A:** You can start using SDLC.ai in minutes:
1. Sign up for a free account
2. Get your API key from the dashboard
3. Install our SDK (JavaScript, Python, or Go)
4. Make your first API call

### Q: What documents formats are supported?
**A:** SDLC.ai supports the following formats:
- **Text**: TXT, MD, RTF
- **Office**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **Web**: HTML, XML
- **Data**: JSON, CSV, YAML
- **Images**: PNG, JPG, JPEG, TIFF (with OCR support)

### Q: Is there a file size limit?
**A:** Yes, the current limits are:
- Free tier: 10MB per file
- Pro tier: 50MB per file
- Enterprise: Custom limits (up to 1GB)

### Q: Can I try SDLC.ai for free?
**A:** Yes! We offer a free tier that includes:
- 1,000 API requests per month
- 100 documents storage
- Basic features
- Community support

---

## API Questions

### Q: How do I authenticate API requests?
**A:** All API requests require a Bearer token in the Authorization header:
```bash
curl -H "Authorization: Bearer your-api-key-here" \
     https://api.sdlc.cc/v3/documents
```

### Q: What's the rate limit?
**A:** Rate limits vary by plan:
- Free: 100 requests/minute
- Pro: 1,000 requests/minute
- Enterprise: Custom limits

You can check your current rate limit status in the response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Q: How long do documents take to process?
**A:** Processing times vary by document type and size:
- Text documents: < 30 seconds
- PDFs: 1-3 minutes
- Images with OCR: 2-5 minutes
- Large documents (>10MB): 5-10 minutes

You can check processing status using the document status endpoint.

### Q: What's the maximum context window for RAG queries?
**A:** The maximum context window is 100,000 tokens for enterprise plans. Standard plans have a 10,000 token limit. You can specify your desired context limit in your RAG query request.

### Q: How does RAG work?
**A:** RAG (Retrieval-Augmented Generation) works in three steps:
1. **Retrieval**: We search your documents for relevant context
2. **Augmentation**: We combine the context with your query
3. **Generation**: We send both to an LLM to generate an answer with sources

### Q: Can I use my own LLM?
**A:** Yes! Enterprise plans support:
- Custom OpenAI/Azure endpoints
- Custom Anthropic endpoints
- Bring your own model (BYOM) with API gateway
- On-premise model integration

---

## SDKs and Integration

### Q: Which programming languages are supported?
**A:** We officially support:
- **JavaScript/TypeScript**: npm package `@sdlc.cc/sdk`
- **Python**: pip package `sdlc-ai`
- **Go**: Go module `github.com/sdlc-ai/sdlc-go`

We also have community-supported SDKs for Ruby, PHP, and Java.

### Q: How do I handle file uploads in different languages?
**A:** Here are examples for each language:

**JavaScript/TypeScript:**
```javascript
const fileInput = document.getElementById('file');
const file = fileInput.files[0];

const document = await client.documents.upload({
  file: file,
  name: 'My Document',
  description: 'Optional description'
});
```

**Python:**
```python
with open('document.pdf', 'rb') as f:
    document = client.documents.upload(
        file=f,
        name='My Document',
        description='Optional description'
    )
```

**Go:**
```go
file, err := os.Open("document.pdf")
if err != nil {
    log.Fatal(err)
}
defer file.Close()

doc, err := client.Documents.Upload(context.Background(), &sdlc.UploadDocumentRequest{
    File:        file,
    Name:        "My Document",
    Description: "Optional description",
})
```

### Q: Do you provide webhook support?
**A:** Yes! You can configure webhooks to receive notifications for:
- Document processing completion
- Query completion
- Error events
- Usage alerts

Configure webhooks in your dashboard or via the API.

---

## Security and Compliance

### Q: How is my data secured?
**A:** We implement multiple layers of security:
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Authentication**: JWT-based with short-lived tokens
- **Authorization**: Role-based and attribute-based access control
- **Network**: Cloudflare WAF and DDoS protection
- **Audit**: Immutable audit logs

### Q: Is my data used for training AI models?
**A:** No, absolutely not. Your data is never used to train third-party models. All processing happens in your isolated environment.

### Q: Are you GDPR compliant?
**A:** Yes, we are fully GDPR compliant. We provide:
- Data processing agreements
- Right to be forgotten implementation
- Data portability exports
- Consent management
- Data breach notifications
- EU data residency options

### Q: What about HIPAA compliance?
**A:** We offer HIPAA-compliant deployments for healthcare organizations. This includes:
- Business associate agreements (BAA)
- PHI protection
- Audit trails
- Access controls
- Encrypted storage and transmission

### Q: Can I self-host SDLC.ai?
**A:** Yes, enterprise plans offer:
- Private cloud deployment
- On-premise installation
- Air-gapped deployments
- Custom security configurations

### Q: How is multi-tenancy implemented?
**A:** Each tenant has:
- Isolated database schema
- Separate storage buckets
- Unique encryption keys
- Isolated compute environments
- No data sharing between tenants

---

## Pricing and Billing

### Q: How does pricing work?
**A:** We have three tiers:

**Free Tier ($0/month)**
- 1,000 API requests
- 100 documents storage
- Basic features
- Community support

**Pro Tier ($99/month)**
- 100,000 API requests
- 10,000 documents storage
- Advanced features
- Email support

**Enterprise (Custom)**
- Unlimited requests
- Unlimited storage
- All features
- Priority support
- SLA guarantees

### Q: What happens if I exceed my limits?
**A:** 
- Free tier: API calls will return a 429 status
- Pro tier: Overage charges at $0.001 per API call
- Enterprise: Unlimited usage included

You'll receive email notifications at 80% and 100% of your limit.

### Q: Can I set usage alerts?
**A:** Yes, you can configure:
- Daily/weekly usage reports
- Threshold alerts (e.g., notify at 80% usage)
- Budget alerts
- Anomaly detection

### Q: Do you offer discounts?
**A:** We offer discounts for:
- Annual billing (20% off)
- Non-profits (50% off)
- Startups (special pricing)
- Volume commitments

---

## Troubleshooting

### Q: Why is my document stuck in "processing" status?
**A:** Common causes and solutions:
1. **Large file**: Reduce file size or split into smaller documents
2. **Corrupted file**: Try re-uploading the file
3. **Unsupported format**: Check if your format is supported
4. **Server overload**: Try again in a few minutes

If the issue persists, contact support with the document ID.

### Q: Why am I getting authentication errors?
**A:** Check the following:
1. API key is correct and active
2. No trailing spaces in the API key
3. Using the correct endpoint (https://api.sdlc.cc/v3)
4. Token hasn't expired (check the `exp` claim)

### Q: Why are my RAG responses slow?
**A:** Performance depends on:
1. **Number of documents**: Search more specific document sets
2. **Context size**: Reduce context window if not needed
3. **Model choice**: Some models are faster than others
4. **Query complexity**: Simplify complex queries

### Q: How do I debug API issues?
**A:** Use these debugging tools:
1. **Request ID**: Each response includes a request ID
2. **Verbose logging**: Enable debug mode in SDKs
3. **Status endpoints**: Check `/health` and `/status`
4. **Response headers**: Check for error codes and messages

Example error response:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_DOCUMENT",
    "message": "Document format not supported",
    "details": {
      "supportedFormats": ["pdf", "doc", "docx", "txt"],
      "receivedFormat": "exe"
    },
    "requestId": "req_123456789"
  }
}
```

### Q: Why are my embeddings failing?
**A:** Common issues:
1. **Rate limits**: Check OpenAI/Anthropic usage
2. **Invalid text**: Text might be empty or too long
3. **API key issues**: Verify LLM provider keys
4. **Network issues**: Check firewall/proxy settings

---

## Best Practices

### Q: How should I structure my documents?
**A:** Follow these guidelines:
1. **Chunk size**: Use 1000-2000 character chunks
2. **Overlap**: Include 10-20% overlap between chunks
3. **Headers**: Use clear headers and subheaders
4. **Metadata**: Add relevant tags and descriptions
5. **Quality**: Remove unnecessary content and formatting

### Q: How can I optimize RAG performance?
**A:** Best practices:
1. **Specific queries**: More specific questions get better answers
2. **Document filtering**: Limit search to relevant documents
3. **Context tuning**: Adjust context size based on query complexity
4. **Model selection**: Use appropriate models for your use case
5. **Caching**: Enable response caching for repeated queries

### Q: Should I pre-process documents?
**A:** Consider pre-processing for:
1. **Large PDFs**: Split into smaller documents
2. **Tables**: Extract and format properly
3. **Images**: Use high-quality images for better OCR
4. **Languages**: Specify document language for better processing
5. **Sensitive data**: Redact before upload if needed

### Q: How do I handle versioning?
**A:** Recommended approach:
1. **Document versions**: Include version in filename
2. **Metadata**: Track version information
3. **Archive old versions**: Keep but don't search in active queries
4. **Change tracking**: Use webhooks to track updates

### Q: What's the best way to organize documents?
**A:** Use these strategies:
1. **Collections**: Group related documents
2. **Tags**: Apply multiple tags for flexible filtering
3. **Hierarchies**: Create folder-like structures
4. **Access control**: Set permissions at collection level
5. **Naming conventions**: Use consistent, descriptive names

---

## Advanced Topics

### Q: Can I fine-tune models on my data?
**A:** Yes, enterprise plans support:
- Fine-tuning OpenAI models
- Custom model training
- Transfer learning
- Model versioning
- A/B testing

### Q: How do I implement custom embeddings?
**A:** Options include:
1. **Bring your own embeddings**: Use custom embedding models
2. **Hybrid search**: Combine multiple embedding models
3. **Fine-tuning**: Fine-tune embedding models on your domain
4. **Multi-modal**: Use text + image embeddings

### Q: Can I create custom DLP rules?
**A:** Yes, you can:
1. **Custom patterns**: Define regex patterns
2. **ML classifiers**: Train custom DLP models
3. **Named entities**: Extract specific entity types
4. **Context rules**: Apply rules based on document context

### Q: How do I implement custom authentication?
**A**: Options include:
1. **SAML SSO**: Enterprise single sign-on
2. **OAuth 2.0**: Custom OAuth providers
3. **JWT validation**: Custom JWT verification
4. **Webhooks**: Real-time authentication events

---

## Still Need Help?

If you couldn't find an answer to your question:

1. **Check our documentation**: https://docs.sdlc.cc
2. **Search our community forum**: https://community.sdlc.cc
3. **Contact support**: support@sdlc.cc
4. **Schedule a demo**: https://sdlc.cc/demo

### Contact Information
- **Email**: support@sdlc.cc
- **Slack**: https://sdlc.cc/slack
- **Twitter**: @sdlc_ai
- **Status Page**: https://status.sdlc.cc

### Response Times
- **Community Forum**: 24-48 hours
- **Email Support**: Pro tier (24 hours), Enterprise (4 hours)
- **Priority Support**: Enterprise only (1 hour)
- **Phone Support**: Enterprise only

---

*Last updated: November 2025*