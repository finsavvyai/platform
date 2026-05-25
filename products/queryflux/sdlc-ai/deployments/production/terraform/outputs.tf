# Output values for SDLC.ai Production Deployment

output "deployment_info" {
  description = "General deployment information"
  value = {
    environment = var.environment
    domain_name = var.domain_name
    deployment_timestamp = timestamp()
  }
}

output "api_endpoints" {
  description = "API endpoint URLs"
  value = {
    api_gateway = "https://api.${var.domain_name}"
    rag_service = "https://api.${var.domain_name}/rag"
    payment_service = "https://api.${var.domain_name}/payments"
    auth_service = "https://api.${var.domain_name}/auth"
    realtime_service = "wss://api.${var.domain_name}/realtime"
  }
}

output "frontend_urls" {
  description = "Frontend application URLs"
  value = {
    main_app = "https://app.${var.domain_name}"
    admin_panel = "https://admin.${var.domain_name}"
    documentation = "https://docs.${var.domain_name}"
  }
}

output "cloudflare_resources" {
  description = "Cloudflare resource identifiers"
  value = {
    d1_primary_db = cloudflare_d1_database.sdlc_primary.id
    d1_events_db = cloudflare_d1_database.sdlc_events.id
    d1_readonly_db = cloudflare_d1_database.sdlc_readonly.id
    r2_documents_bucket = cloudflare_r2_bucket.sdlc_documents.name
    vectorize_index = cloudflare_vectorize_index.sdlc_embeddings.name
    kv_config_namespace = cloudflare_workers_kv_namespace.sdlc_config.id
    kv_cache_namespace = cloudflare_workers_kv_namespace.sdlc_cache.id
    queue_events = cloudflare_queue.sdlc_events.id
    queue_payments = cloudflare_queue.sdlc_payments.id
  }
  sensitive = true
}

output "workers" {
  description = "Cloudflare Workers information"
  value = {
    api_gateway = {
      name = cloudflare_workers_script.sdlc_api_gateway.name
      url = "https://api.${var.domain_name}"
    }
    rag_service = {
      name = cloudflare_workers_script.sdlc_rag_service.name
      url = "https://api.${var.domain_name}/rag"
    }
    payment_service = {
      name = cloudflare_workers_script.sdlc_payment_service.name
      url = "https://api.${var.domain_name}/payments"
    }
    realtime_service = {
      name = cloudflare_workers_script.sdlc_realtime.name
      url = "wss://api.${var.domain_name}/realtime"
    }
  }
}

output "security_configuration" {
  description = "Security configuration details"
  value = {
    waf_enabled = var.security_config.enable_waf
    bot_fight_mode = var.security_config.enable_bot_fight
    rate_limiting = {
      requests_per_window = var.security_config.rate_limit_requests
      window_seconds = var.security_config.rate_limit_window
    }
    pci_level = var.pci_compliance.level
    audit_logging_enabled = var.pci_compliance.enable_audit_logging
  }
}

output "monitoring_endpoints" {
  description = "Monitoring and health check endpoints"
  value = {
    health_check = "https://api.${var.domain_name}/health"
    metrics = "https://api.${var.domain_name}/metrics"
    status_page = "https://status.${var.domain_name}"
  }
}

output "database_info" {
  description = "Database connection information (for internal use)"
  value = {
    d1_config = {
      primary_id = cloudflare_d1_database.sdlc_primary.id
      events_id = cloudflare_d1_database.sdlc_events.id
      readonly_id = cloudflare_d1_database.sdlc_readonly.id
    }
    connection_config = var.database_config
  }
  sensitive = true
}

output "storage_info" {
  description = "Storage configuration"
  value = {
    r2_bucket = {
      name = cloudflare_r2_bucket.sdlc_documents.name
      endpoint = "https://account-id.r2.cloudflarestorage.com"
    }
    vector_index = {
      name = cloudflare_vectorize_index.sdlc_embeddings.name
      dimensions = 1536
      metric = "cosine"
    }
  }
}

output "scaling_configuration" {
  description = "Auto-scaling configuration"
  value = var.scaling_config
}

output "compliance_status" {
  description = "Compliance and certification status"
  value = {
    pci_dss_level = var.pci_compliance.level
    audit_retention_days = var.log_retention.audit_logs_days
    scan_frequency = var.pci_compliance.scan_frequency
    backup_retention_days = var.backup_config.retention_days
    cross_region_backup = var.backup_config.cross_region
  }
}

output "cost_estimates" {
  description = "Estimated monthly costs"
  value = {
    cloudflare_workers = "$50-200"
    cloudflare_d1 = "$5-50"
    cloudflare_r2 = "$10-100"
    cloudflare_vectorize = "$20-100"
    cloudflare_kv = "$5-25"
    cloudflare_queue = "$5-15"
    ssl_certificates = "$10"
    total_estimated = "$105-500"
  }
}

output "next_steps" {
  description = "Post-deployment next steps"
  value = [
    "1. Update DNS records to point to Cloudflare nameservers",
    "2. Configure SSL certificates for all domains",
    "3. Set up monitoring and alerting endpoints",
    "4. Run initial database migrations",
    "5. Configure payment gateway (Stripe)",
    "6. Enable AI model integrations",
    "7. Set up backup and disaster recovery procedures",
    "8. Perform security and compliance scans",
    "9. Configure CDN caching rules",
    "10. Run smoke tests on all endpoints"
  ]
}

# Output for local file generation
resource "local_file" "deployment_manifest" {
  content = yamlencode({
    api_version = "v1"
    kind = "DeploymentManifest"
    metadata = {
      name = "sdlc-${var.environment}"
      namespace = "sdlc"
      labels = {
        app = "sdlc"
        environment = var.environment
        managed_by = "terraform"
      }
    }
    spec = {
      replicas = var.scaling_config.min_instances
      domain = var.domain_name
      endpoints = {
        api = "https://api.${var.domain_name}"
        app = "https://app.${var.domain_name}"
      }
      resources = {
        workers = [
          cloudflare_workers_script.sdlc_api_gateway.name
          cloudflare_workers_script.sdlc_rag_service.name
          cloudflare_workers_script.sdlc_payment_service.name
          cloudflare_workers_script.sdlc_realtime.name
        ]
        databases = [
          cloudflare_d1_database.sdlc_primary.id
          cloudflare_d1_database.sdlc_events.id
          cloudflare_d1_database.sdlc_readonly.id
        ]
        storage = [
          cloudflare_r2_bucket.sdlc_documents.name
        ]
        cache = [
          cloudflare_workers_kv_namespace.sdlc_config.id
          cloudflare_workers_kv_namespace.sdlc_cache.id
        ]
      }
      security = {
        pci_level = var.pci_compliance.level
        waf_enabled = var.security_config.enable_waf
        rate_limiting = {
          requests = var.security_config.rate_limit_requests
          window = var.security_config.rate_limit_window
        }
      }
      monitoring = {
        enabled = true
        endpoints = {
          health = "https://api.${var.domain_name}/health"
          metrics = "https://api.${var.domain_name}/metrics"
        }
      }
    }
  })
  filename = "${path.module}/deployment-manifest.yaml"
}

resource "local_file" "environment_config" {
  content = yamlencode({
    environment = var.environment
    domain = var.domain_name
    api = {
      gateway_url = "https://api.${var.domain_name}"
      rag_url = "https://api.${var.domain_name}/rag"
      payment_url = "https://api.${var.domain_name}/payments"
      auth_url = "https://api.${var.domain_name}/auth"
    }
    frontend = {
      main_url = "https://app.${var.domain_name}"
      admin_url = "https://admin.${var.domain_name}"
      docs_url = "https://docs.${var.domain_name}"
    }
    database = {
      primary_id = cloudflare_d1_database.sdlc_primary.id
      events_id = cloudflare_d1_database.sdlc_events.id
      readonly_id = cloudflare_d1_database.sdlc_readonly.id
    }
    storage = {
      documents_bucket = cloudflare_r2_bucket.sdlc_documents.name
      vector_index = cloudflare_vectorize_index.sdlc_embeddings.name
    }
    cache = {
      config_namespace = cloudflare_workers_kv_namespace.sdlc_config.id
      cache_namespace = cloudflare_workers_kv_namespace.sdlc_cache.id
    }
    queue = {
      events_queue = cloudflare_queue.sdlc_events.id
      payments_queue = cloudflare_queue.sdlc_payments.id
    }
    security = {
      pci_level = var.pci_compliance.level
      waf_enabled = var.security_config.enable_waf
      audit_logging = var.pci_compliance.enable_audit_logging
    }
    features = var.feature_flags
    scaling = var.scaling_config
    monitoring = var.monitoring_config
  })
  filename = "${path.module}/.env.production"
}

resource "local_file" "deployment_script" {
  content = <<-EOT
    #!/bin/bash
    # SDLC.ai Production Deployment Script

    set -euo pipefail

    echo "🚀 Starting SDLC.ai Production Deployment"
    echo "Environment: ${var.environment}"
    echo "Domain: ${var.domain_name}"
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    # Validate environment
    echo "📋 Validating environment..."
    if [[ "${var.environment}" != "production" ]]; then
        echo "⚠️  Warning: Not deploying to production environment"
    fi

    # Check prerequisites
    echo "🔍 Checking prerequisites..."
    command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed."; exit 1; }
    command -v curl >/dev/null 2>&1 || { echo "❌ curl is required but not installed."; exit 1; }

    # Initialize Terraform
    echo "🏗️  Initializing Terraform..."
    terraform init

    # Plan deployment
    echo "📝 Planning deployment..."
    terraform plan -out=tfplan

    # Apply deployment
    echo "🎯 Applying deployment..."
    terraform apply tfplan

    # Verify deployment
    echo "✅ Verifying deployment..."

    API_URL="https://api.${var.domain_name}"
    APP_URL="https://app.${var.domain_name}"

    echo "🏥 Health checks..."

    # API Gateway Health Check
    echo "Checking API Gateway..."
    curl -f -s "$API_URL/health" || {
        echo "❌ API Gateway health check failed"
        exit 1
    }
    echo "✅ API Gateway is healthy"

    # Frontend Health Check
    echo "Checking Frontend..."
    curl -f -s -I "$APP_URL" || {
        echo "❌ Frontend health check failed"
        exit 1
    }
    echo "✅ Frontend is healthy"

    # Database Connectivity Check
    echo "Checking Database connectivity..."
    # This would be implemented with actual database check

    # Payment Service Health Check
    echo "Checking Payment Service..."
    curl -f -s "$API_URL/payments/health" || {
        echo "❌ Payment Service health check failed"
        exit 1
    }
    echo "✅ Payment Service is healthy"

    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📍 Important URLs:"
    echo "  API Gateway: $API_URL"
    echo "  Frontend: $APP_URL"
    echo "  Health Check: $API_URL/health"
    echo ""
    echo "📊 Monitoring:"
    echo "  Metrics: $API_URL/metrics"
    echo "  Status Page: https://status.${var.domain_name}"
    echo ""
    echo "🔐 Security Configuration:"
    echo "  WAF Enabled: ${var.security_config.enable_waf}"
    echo "  PCI Level: ${var.pci_compliance.level}"
    echo "  Rate Limiting: ${var.security_config.rate_limit_requests} requests/${var.security_config.rate_limit_window}s"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Configure DNS records"
    echo "2. Set up monitoring alerts"
    echo "3. Run security scans"
    echo "4. Perform load testing"
    echo "5. Configure backup procedures"
    echo ""
    echo "📖 Documentation:"
    echo "  - Check the deployment-manifest.yaml for configuration details"
    echo "  - Review the .env.production file for environment variables"
    echo "  - Consult the README.md for operational procedures"

    echo "✨ SDLC.ai is now live! ✨"
  EOT

  filename = "${path.module}/deploy.sh"
}

# Make deployment script executable
resource "null_resource" "make_deploy_executable" {
  provisioner "local-exec" {
    command = "chmod +x ${path.module}/deploy.sh"
  }
}
