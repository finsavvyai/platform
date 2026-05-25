# SDLC.ai Production Infrastructure
# Enterprise-ready deployment with PCI DSS compliance

terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Configure providers
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SDLC.ai"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "PCI-DSS-Level-1"
    }
  }
}

# Generate random values for security
resource "random_password" "database_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = true
}

resource "random_id" "deployment_suffix" {
  byte_length = 4
}

# Cloudflare D1 Databases
resource "cloudflare_d1_database" "sdlc_primary" {
  name       = "sdlc-primary-db-${var.environment}-${random_id.deployment_suffix.hex}"
  account_id = var.cloudflare_account_id
}

resource "cloudflare_d1_database" "sdlc_events" {
  name       = "sdlc-events-db-${var.environment}-${random_id.deployment_suffix.hex}"
  account_id = var.cloudflare_account_id
}

resource "cloudflare_d1_database" "sdlc_readonly" {
  name       = "sdlc-readonly-db-${var.environment}-${random_id.deployment_suffix.hex}"
  account_id = var.cloudflare_account_id
}

# Cloudflare Vectorize for RAG
resource "cloudflare_vectorize_index" "sdlc_embeddings" {
  name       = "sdlc-embeddings-${var.environment}"
  account_id = var.cloudflare_account_id
  config = {
    dimensions = 1536
    metric     = "cosine"
  }
}

# Cloudflare R2 Storage for documents
resource "cloudflare_r2_bucket" "sdlc_documents" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-documents-${var.environment}-${random_id.deployment_suffix.hex}"
  location   = "wnam" # Western North America for PCI compliance
}

# Cloudflare KV for configuration and caching
resource "cloudflare_workers_kv_namespace" "sdlc_config" {
  title      = "sdlc-config-${var.environment}"
  account_id = var.cloudflare_account_id
}

resource "cloudflare_workers_kv_namespace" "sdlc_cache" {
  title      = "sdlc-cache-${var.environment}"
  account_id = var.cloudflare_account_id
}

# Cloudflare Queues for event processing
resource "cloudflare_queue" "sdlc_events" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-events-${var.environment}"
}

resource "cloudflare_queue" "sdlc_payments" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-payments-${var.environment}"
}

# Cloudflare Durable Objects for real-time features
resource "cloudflare_workers_script" "sdlc_realtime" {
  name       = "sdlc-realtime-${var.environment}"
  account_id = var.cloudflare_account_id

  content = file("${path.module}/workers/realtime.js")
}

# Cloudflare Workers for API Gateway
resource "cloudflare_workers_script" "sdlc_api_gateway" {
  name       = "sdlc-api-gateway-${var.environment}"
  account_id = var.cloudflare_account_id

  content = file("${path.module}/workers/api-gateway.js")

  kv_namespace_bindings {
    name         = "CONFIG"
    namespace_id = cloudflare_workers_kv_namespace.sdlc_config.id
  }

  kv_namespace_bindings {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.sdlc_cache.id
  }

  queue_bindings {
    name         = "EVENTS"
    binding      = "EVENTS_QUEUE"
    namespace_id = cloudflare_queue.sdlc_events.id
  }

  r2_bucket_bindings {
    name        = "DOCUMENTS"
    bucket_name = cloudflare_r2_bucket.sdlc_documents.name
  }

  d1_database_bindings {
    name        = "PRIMARY_DB"
    database_id = cloudflare_d1_database.sdlc_primary.id
  }

  vectorize_bindings {
    name       = "EMBEDDINGS"
    index_name = cloudflare_vectorize_index.sdlc_embeddings.name
  }
}

# Cloudflare Workers for RAG Service
resource "cloudflare_workers_script" "sdlc_rag_service" {
  name       = "sdlc-rag-service-${var.environment}"
  account_id = var.cloudflare_account_id

  content = file("${path.module}/workers/rag-service.js")

  d1_database_bindings {
    name        = "PRIMARY_DB"
    database_id = cloudflare_d1_database.sdlc_primary.id
  }

  d1_database_bindings {
    name        = "EVENTS_DB"
    database_id = cloudflare_d1_database.sdlc_events.id
  }

  r2_bucket_bindings {
    name        = "DOCUMENTS"
    bucket_name = cloudflare_r2_bucket.sdlc_documents.name
  }

  vectorize_bindings {
    name       = "EMBEDDINGS"
    index_name = cloudflare_vectorize_index.sdlc_embeddings.name
  }
}

# Cloudflare Workers for Payment Service (PCI DSS)
resource "cloudflare_workers_script" "sdlc_payment_service" {
  name       = "sdlc-payment-service-${var.environment}"
  account_id = var.cloudflare_account_id

  content = file("${path.module}/workers/payment-service.js")

  d1_database_bindings {
    name        = "PRIMARY_DB"
    database_id = cloudflare_d1_database.sdlc_primary.id
  }

  d1_database_bindings {
    name        = "EVENTS_DB"
    database_id = cloudflare_d1_database.sdlc_events.id
  }

  queue_bindings {
    name         = "PAYMENTS"
    binding      = "PAYMENTS_QUEUE"
    namespace_id = cloudflare_queue.sdlc_payments.id
  }

  secret_text_bindings {
    name = "STRIPE_SECRET_KEY"
    text = var.stripe_secret_key
  }

  secret_text_bindings {
    name = "ENCRYPTION_KEY"
    text = var.encryption_key
  }
}

# Custom domains with SSL
resource "cloudflare_zone" "sdlc_domain" {
  zone = var.domain_name
}

resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "api"
  value   = "workers.dev"
  type    = "CNAME"
  ttl     = 300
}

resource "cloudflare_record" "app" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "app"
  value   = "workers.dev"
  type    = "CNAME"
  ttl     = 300
}

# SSL/TLS Configuration
resource "cloudflare_record" "caa" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "@"
  type    = "CAA"
  data {
    flags = 0
    tag   = "issue"
    value = "letsencrypt.org"
  }
  ttl = 300
}

# DNS for subdomains
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "www"
  value   = "workers.dev"
  type    = "CNAME"
  ttl     = 300
}

# Cloudflare Pages for frontend
resource "cloudflare_pages_project" "sdlc_frontend" {
  account_id        = var.cloudflare_account_id
  name              = "sdlc-frontend-${var.environment}"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "frontend"
  }

  source {
    type = "github"
    config {
      owner               = var.github_owner
      repo_name           = var.github_repo
      production_branch   = "main"
      deployments_per_day = 5
    }
  }
}

# Cloudflare Rules for security and routing
resource "cloudflare_ruleset" "sdlc_security_rules" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "SDLC Security Rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949d940a18bd8d4438fa108cc"
    }
    expression  = "(http.request.uri.path contains \"/api/\")"
    description = "Apply WAF rules to API endpoints"
    enabled     = true
  }

  rules {
    action      = "block"
    expression  = "(cf.bot_management.score < 30) and (http.request.uri.path contains \"/api/\")"
    description = "Block suspicious bots from API"
    enabled     = true
  }
}

# Cloudflare Rules for rate limiting
resource "cloudflare_ruleset" "sdlc_rate_limits" {
  zone_id = cloudflare_zone.sdlc_domain.id
  name    = "SDLC Rate Limits"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action = "block"
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 1000
      mitigation_time     = 300
    }
    expression  = "(http.request.uri.path contains \"/api/\")"
    description = "Rate limit API endpoints"
    enabled     = true
  }

  rules {
    action = "block"
    ratelimit {
      characteristics     = ["ip.src", "http.request.uri.path"]
      period              = 60
      requests_per_period = 100
      mitigation_time     = 600
    }
    expression  = "(http.request.uri.path contains \"/api/v1/auth/login\")"
    description = "Strict rate limiting for auth endpoints"
    enabled     = true
  }
}

# Cloudflare Load Balancer for high availability
resource "cloudflare_load_balancer" "sdlc_load_balancer" {
  zone_id          = cloudflare_zone.sdlc_domain.id
  name             = "sdlc-lb-${var.environment}"
  fallback_pool_id = cloudflare_load_balancer_pool.primary.id

  default_pool_ids = [cloudflare_load_balancer_pool.primary.id]

  rules {
    name      = "api-routing"
    condition = "(http.request.uri.path starts_with \"/api/\")"
    terminal  = true
    overrides {
      default_pool = cloudflare_load_balancer_pool.api.id
    }
  }

  rules {
    name      = "app-routing"
    condition = "(http.request.uri.path starts_with \"/app/\")"
    terminal  = true
    overrides {
      default_pool = cloudflare_load_balancer_pool.app.id
    }
  }
}

resource "cloudflare_load_balancer_pool" "primary" {
  name              = "sdlc-primary-pool-${var.environment}"
  check_interval    = 60
  health_check_type = "http"
  origin_steering   = true

  origins {
    name    = "api-gateway"
    address = "sdlc-api-gateway-${var.environment}.workers.dev"
    enabled = true
    header {
      header = "Host"
      value  = var.domain_name
    }
  }
}

resource "cloudflare_load_balancer_pool" "api" {
  name              = "sdlc-api-pool-${var.environment}"
  check_interval    = 60
  health_check_type = "http"

  origins {
    name    = "api-gateway"
    address = "sdlc-api-gateway-${var.environment}.workers.dev"
    enabled = true
    header {
      header = "Host"
      value  = var.domain_name
    }
  }
}

resource "cloudflare_load_balancer_pool" "app" {
  name              = "sdlc-app-pool-${var.environment}"
  check_interval    = 60
  health_check_type = "http"

  origins {
    name    = "frontend"
    address = "${cloudflare_pages_project.sdlc_frontend.subdomain}.pages.dev"
    enabled = true
  }
}

# Cloudflare Web Application Firewall (WAF)
resource "cloudflare_waf_rule" "sqli_protection" {
  zone_id   = cloudflare_zone.sdlc_domain.id
  filter_id = cloudflare_waf_filter.sqli.id
  action    = "block"
  paused    = false
}

resource "cloudflare_waf_filter" "sqli" {
  zone_id     = cloudflare_zone.sdlc_domain.id
  description = "SQL Injection Protection"
  expression = join(" or ", [
    "(http.request.uri.query contains \"SELECT\")",
    "(http.request.uri.query contains \"INSERT\")",
    "(http.request.uri.query contains \"UPDATE\")",
    "(http.request.uri.query contains \"DELETE\")",
  ])
}

# Monitoring and Analytics
resource "cloudflare_argo" "sdlc_argo" {
  zone_id        = cloudflare_zone.sdlc_domain.id
  tiered_caching = "on"
  smart_routing  = "on"
}

# Output important values
output "api_gateway_url" {
  description = "URL of the API Gateway Worker"
  value       = "https://api.${var.domain_name}"
}

output "frontend_url" {
  description = "URL of the frontend application"
  value       = "https://app.${var.domain_name}"
}

output "d1_primary_database_id" {
  description = "ID of the primary D1 database"
  value       = cloudflare_d1_database.sdlc_primary.id
  sensitive   = true
}

output "r2_documents_bucket_name" {
  description = "Name of the documents R2 bucket"
  value       = cloudflare_r2_bucket.sdlc_documents.name
}

output "vectorize_index_name" {
  description = "Name of the vectorize index"
  value       = cloudflare_vectorize_index.sdlc_embeddings.name
}
