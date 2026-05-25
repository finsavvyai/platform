# Domain Management and SEO Optimization

This document describes the multi-domain architecture and SEO optimization setup for MCPOverflow.

## Overview

MCPOverflow uses a multi-domain architecture to separate concerns and optimize user experience:

- **mcpoverflow.com** - Marketing website with information about the platform
- **app.mcpoverflow.io** - Developer platform for building and managing MCP connectors
- **mcpoverflow.ai** - AI platform for intelligent agent management
- **mcpoverflow.dev** - Documentation and developer guides

## Architecture

### Domain Detection

The system automatically detects the current domain based on the HTTP host header and applies domain-specific configurations:

```go
// Domain detection logic
domain := domainService.DetectDomain(c.Request.Host)
```

### Configuration Structure

Each domain has its own configuration including:

- **URL**: The primary URL for the domain
- **Name**: Human-readable domain name
- **Title**: SEO title for the domain
- **Description**: SEO description for the domain
- **Theme**: Visual theme identifier
- **Redirects**: Domain-specific URL redirects
- **Headers**: Security and customization headers

### SEO Features

#### Sitemaps

- Automatic sitemap generation for each domain
- Domain-specific URL patterns
- Dynamic content inclusion
- Located at `/sitemap.xml`

#### Robots.txt

- Domain-specific crawling rules
- Automatic sitemap inclusion
- Environment-aware settings
- Located at `/robots.txt`

#### Open Graph Tags

- Dynamic meta tag generation
- Social media optimization
- Domain-specific branding
- Accessible via `/opengraph` endpoint

#### Structured Data

- JSON-LD structured data for SEO
- Domain-specific schema types
- Automatic schema.org compliance
- Accessible via `/structured-data/:page`

## Configuration

### Environment Variables

Domain management is configured through environment variables:

```bash
# Domain Configuration
DOMAIN_DEFAULT=marketing
DOMAIN_SSL_ENABLED=true
DOMAIN_CDN_ENABLED=true

# Marketing Site
DOMAIN_MARKETING_URL=https://mcpoverflow.com
DOMAIN_MARKETING_TITLE=MCPOverflow - AI-Powered MCP Connector Platform
DOMAIN_MARKETING_DESCRIPTION=Generate MCP connectors instantly...

# Developer Platform
DOMAIN_DEVELOPER_URL=https://app.mcpoverflow.io
DOMAIN_DEVELOPER_TITLE=MCPOverflow Developer Platform - Build MCP Connectors
DOMAIN_DEVELOPER_DESCRIPTION=Access powerful tools...

# AI Platform
DOMAIN_AI_URL=https://mcpoverflow.ai
DOMAIN_AI_TITLE=MCPOverflow AI - Intelligent Agent Management
DOMAIN_AI_DESCRIPTION=Deploy and manage AI agents...

# Documentation Site
DOMAIN_DOCS_URL=https://mcpoverflow.dev
DOMAIN_DOCS_TITLE=MCPOverflow Documentation - Developer Guide
DOMAIN_DOCS_DESCRIPTION=Complete guide to building MCP connectors...

# SEO Configuration
SEO_SITE_NAME=MCPOverflow
SEO_DESCRIPTION=Generate MCP connectors instantly...
SEO_KEYWORDS=MCP,AI,OpenAPI,GraphQL,Postman,connector,agent,automation,API
SEO_OG_IMAGE=https://mcpoverflow.com/og-image.png
SEO_TWITTER_CARD=summary_large_image
SEO_TWITTER_SITE=@mcpoverflow
SEO_ANALYTICS_ID=G-XXXXXXXXXX
SEO_SITEMAP_ENABLED=true
SEO_ROBOTS_ENABLED=true
SEO_INDEXING_ENABLED=true
SEO_STRUCTURED_DATA=true
```

### Domain-Specific Features

#### Marketing Site (mcpoverflow.com)

- **Purpose**: Lead generation and product information
- **Features**: Landing pages, pricing, feature showcases
- **SEO**: High priority, extensive structured data
- **Security**: Standard security headers
- **Redirects**: `/docs` → mcpoverflow.dev, `/app` → app.mcpoverflow.io, `/ai` → mcpoverflow.ai

#### Developer Platform (app.mcpoverflow.io)

- **Purpose**: MCP connector development and management
- **Features**: Dashboard, connector editor, deployment tools
- **SEO**: Limited indexing (authenticated content)
- **Security**: Enhanced security, strict CSP
- **Redirects**: `/` → `/dashboard`, `/docs` → mcpoverflow.dev

#### AI Platform (mcpoverflow.ai)

- **Purpose**: AI agent management and chat interface
- **Features**: Agent dashboard, chat interface, AI tools
- **SEO**: Standard indexing for public pages
- **Security**: WebSocket support, AI-specific CSP
- **Redirects**: `/chat` → `/`

#### Documentation Site (mcpoverflow.dev)

- **Purpose**: Developer documentation and guides
- **Features**: Documentation pages, API references, examples
- **SEO**: High priority, technical content optimization
- **Security**: Documentation-specific CSP
- **Redirects**: `/` → `/getting-started`

## Deployment

### Docker Setup

The multi-domain setup uses Docker Compose:

```bash
# Start all services with domain configuration
docker-compose -f docker-compose.domains.yml up -d

# Check service status
docker-compose -f docker-compose.domains.yml ps

# View logs
docker-compose -f docker-compose.domains.yml logs -f
```

### Nginx Configuration

Nginx acts as a reverse proxy with:

- **SSL/TLS termination** with automatic HTTPS
- **Domain-based routing** to different services
- **Static file serving** with caching
- **API proxying** with load balancing
- **Security headers** and rate limiting
- **SEO optimization** headers

### SSL Certificate Management

SSL certificates are managed automatically with Let's Encrypt:

```bash
# Setup SSL certificates for all domains
sudo ./scripts/setup-ssl.sh

# Manual renewal
sudo ./scripts/renew-ssl.sh

# View renewal logs
tail -f logs/ssl-renewal.log
```

Certificates are automatically renewed 30 days before expiration.

## Monitoring

### Domain Health

Monitor domain health via the API:

```bash
# Get domain configuration
curl https://mcpoverflow.com/api/v1/domain/config

# Get domain health metrics
curl https://mcpoverflow.com/api/v1/domain/health

# Get domain analytics
curl https://mcpoverflow.com/api/v1/domain/analytics
```

### SEO Monitoring

- **Google Search Console**: Monitor indexing and search performance
- **Google Analytics**: Track traffic and user behavior
- **Site audits**: Regular SEO audits and optimizations
- **Performance monitoring**: Page speed and Core Web Vitals

## Testing

### Domain Detection Tests

```bash
# Run domain management tests
cd services/api-service
go test ./internal/services -v -run TestDomainService
```

### SEO Validation

```bash
# Validate sitemaps
curl -I https://mcpoverflow.com/sitemap.xml
curl -I https://app.mcpoverflow.io/sitemap.xml
curl -I https://mcpoverflow.ai/sitemap.xml
curl -I https://mcpoverflow.dev/sitemap.xml

# Validate robots.txt
curl -I https://mcpoverflow.com/robots.txt
curl -I https://app.mcpoverflow.io/robots.txt

# Validate Open Graph tags
curl https://mcpoverflow.com/opengraph
curl https://app.mcpoverflow.io/opengraph
```

### Security Testing

```bash
# Test SSL certificates
openssl s_client -connect mcpoverflow.com:443 -servername mcpoverflow.com

# Test security headers
curl -I https://mcpoverflow.com
curl -I https://app.mcpoverflow.io
curl -I https://mcpoverflow.ai
curl -I https://mcpoverflow.dev
```

## Maintenance

### Regular Tasks

1. **SSL Certificate Renewal**: Automated daily checks
2. **Domain Health Monitoring**: Automated alerts
3. **SEO Audits**: Monthly comprehensive audits
4. **Performance Optimization**: Weekly performance reviews
5. **Security Updates**: As needed for vulnerabilities

### Troubleshooting

#### Common Issues

1. **SSL Certificate Errors**
   - Check certificate expiration: `./scripts/check-ssl.sh`
   - Renew certificates manually: `./scripts/renew-ssl.sh`
   - Verify Nginx configuration: `docker exec mcpoverflow-nginx nginx -t`

2. **Domain Detection Issues**
   - Check host header: `curl -H "Host: mcpoverflow.com" http://localhost/api/v1/domain/config`
   - Verify domain configuration: Check environment variables
   - Review Nginx configuration for proper routing

3. **SEO Indexing Problems**
   - Check robots.txt: Access `/robots.txt` on each domain
   - Validate sitemaps: Access `/sitemap.xml` on each domain
   - Review meta tags: Access `/opengraph` endpoint
   - Check Google Search Console for indexing issues

4. **Performance Issues**
   - Monitor Nginx logs: `docker logs mcpoverflow-nginx`
   - Check API response times: Use monitoring tools
   - Review static file caching: Check cache headers
   - Analyze database performance: Check query times

## Best Practices

### SEO Best Practices

1. **Unique Content**: Each domain should have unique, valuable content
2. **Canonical URLs**: Use canonical tags to avoid duplicate content
3. **Mobile Optimization**: Ensure responsive design on all domains
4. **Page Speed**: Optimize images, minify CSS/JS, use CDNs
5. **Structured Data**: Use appropriate schema.org markup
6. **Internal Linking**: Link between domains where appropriate

### Security Best Practices

1. **HTTPS Everywhere**: Use SSL/TLS for all domains
2. **Security Headers**: Implement comprehensive security headers
3. **CSP Policies**: Use strict Content Security Policies
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Input Validation**: Validate all user inputs
6. **Regular Updates**: Keep dependencies updated

### Performance Best Practices

1. **Caching Strategy**: Implement appropriate caching at all levels
2. **CDN Usage**: Use CDN for static assets
3. **Image Optimization**: Compress and optimize images
4. **Code Minification**: Minify CSS, JavaScript, and HTML
5. **Database Optimization**: Use proper indexing and query optimization
6. **Monitoring**: Monitor performance metrics continuously

## API Reference

### Domain Endpoints

- `GET /api/v1/domain/config` - Get current domain configuration
- `GET /api/v1/domain/analytics` - Get domain analytics (public)
- `GET /api/v1/domain/health` - Get domain health metrics
- `GET /api/v1/domain/list` - List all domains (admin)
- `POST /api/v1/domain/config` - Update domain configuration (admin)
- `GET /api/v1/domain/validate` - Validate domain configuration

### SEO Endpoints

- `GET /sitemap.xml` - Domain sitemap
- `GET /robots.txt` - Domain robots.txt
- `GET /opengraph` - Open Graph meta tags
- `GET /structured-data/:page` - JSON-LD structured data

## Support

For issues related to domain management and SEO:

1. Check the troubleshooting section above
2. Review logs in the `logs/` directory
3. Consult the API documentation
4. Create an issue in the project repository

## Future Enhancements

Planned improvements to the domain management system:

1. **Geographic Routing**: Route users to nearest data centers
2. **A/B Testing**: Test different domain configurations
3. **Advanced Analytics**: More detailed domain analytics
4. **Multi-language Support**: International domain support
5. **Advanced SEO**: More sophisticated SEO automation
6. **Performance Monitoring**: Real-time performance monitoring