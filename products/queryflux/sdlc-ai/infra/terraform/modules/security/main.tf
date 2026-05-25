# Security Module for SDLC.ai Platform
# Implements comprehensive security controls and monitoring

# KMS Key for encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for ${var.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatch"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowEKS"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowRDS"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowElastiCache"
        Effect = "Allow"
        Principal = {
          Service = "elasticache.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowS3"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-kms-key"
      Type = "KMS Key"
    }
  )
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.name_prefix}"
  target_key_id = aws_kms_key.main.key_id
}

# SSL/TLS Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
    "app.${var.domain_name}",
    "admin.${var.domain_name}",
    "monitoring.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-ssl-cert"
      Type = "ACM Certificate"
    }
  )
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# WAFv2 Web ACL
resource "aws_wafv2_web_acl" "main" {
  name  = "${var.name_prefix}-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection rule
  rule {
    name     = "SQLInjectionRule"
    priority = 2

    statement {
      sqli_match_statement {
        field_to_match {
          body {}
        }
        text_transformations {
          priority = 0
          type     = "URL_DECODE"
        }
        text_transformations {
          priority = 1
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLInjectionRule"
      sampled_requests_enabled   = true
    }
  }

  # XSS rule
  rule {
    name     = "XSSRule"
    priority = 3

    statement {
      xss_match_statement {
        field_to_match {
          body {}
        }
        text_transformations {
          priority = 0
          type     = "URL_DECODE"
        }
        text_transformations {
          priority = 1
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "XSSRule"
      sampled_requests_enabled   = true
    }
  }

  # Common vulnerabilities rule
  rule {
    name     = "CommonVulnerabilitiesRule"
    priority = 4

    statement {
      or_statement {
        statement {
          sqli_match_statement {
            field_to_match {
              uri_path {}
            }
            text_transformations {
              priority = 0
              type     = "URL_DECODE"
            }
          }
        }
        statement {
          xss_match_statement {
            field_to_match {
              uri_path {}
            }
            text_transformations {
              priority = 0
              type     = "URL_DECODE"
            }
          }
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonVulnerabilitiesRule"
      sampled_requests_enabled   = true
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-waf"
      Type = "WAF Web ACL"
    }
  )
}

# Shield Advanced Protection
resource "aws_shield_protection" "main" {
  count = var.enable_shield_advanced ? 1 : 0

  name         = "${var.name_prefix}-shield-protection"
  resource_arn = aws_cloudfront_distribution.main.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-shield-protection"
      Type = "Shield Protection"
    }
  )
}

# Security Hub
resource "aws_securityhub_account" "main" {
  count = var.enable_security_hub ? 1 : 0

  enable_default_standards = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-security-hub"
      Type = "Security Hub"
    }
  )
}

# GuardDuty
resource "aws_guardduty_detector" "main" {
  count = var.enable_guardduty ? 1 : 0

  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-guardduty"
      Type = "GuardDuty"
    }
  )
}

# GuardDuty Publishing Destination
resource "aws_guardduty_publishing_destination" "main" {
  count = var.enable_guardduty ? 1 : 0

  detector_id = aws_guardduty_detector.main[0].id
  destination_arn = aws_s3_bucket.guardduty[0].arn
  kms_key_arn = aws_kms_key.main.arn
}

# S3 Bucket for GuardDuty findings
resource "aws_s3_bucket" "guardduty" {
  count = var.enable_guardduty ? 1 : 0

  bucket = "${var.name_prefix}-guardduty-findings-${random_id.bucket_suffix.hex}"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-guardduty-findings"
      Type = "S3 Bucket"
    }
  )
}

resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# Config Rules
resource "aws_config_configuration_recorder" "main" {
  count = var.enable_config_rules ? 1 : 0

  name     = "${var.name_prefix}-config-recorder"
  role_arn = aws_iam_role.config_recorder[0].arn

  recording_group {
    all_supported = true
  }

  depends_on = [aws_iam_role_policy_attachment.config_recorder]
}

resource "aws_config_delivery_channel" "main" {
  count = var.enable_config_rules ? 1 : 0

  name           = "${var.name_prefix}-config-delivery"
  s3_bucket_name = aws_s3_bucket.config[0].bucket

  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  count = var.enable_config_rules ? 1 : 0

  name = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

# S3 Bucket for Config
resource "aws_s3_bucket" "config" {
  count = var.enable_config_rules ? 1 : 0

  bucket = "${var.name_prefix}-config-${random_id.bucket_suffix.hex}"
  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  lifecycle_rule {
    enabled = true

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 60
      storage_class = "GLACIER"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-config"
      Type = "S3 Bucket"
    }
  )
}

# IAM Role for Config
resource "aws_iam_role" "config_recorder" {
  count = var.enable_config_rules ? 1 : 0

  name = "${var.name_prefix}-config-recorder-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-config-recorder-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "config_recorder" {
  count = var.enable_config_rules ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSConfigRole"
  role       = aws_iam_role.config_recorder[0].name
}

# Macie for data protection
resource "aws_macie2_account" "main" {
  count = var.enable_macie ? 1 : 0

  finding_publishing_frequency = "SIX_HOURS"
  status                        = "ENABLED"

  depends_on = [aws_macie2_organization_admin_account.main]
}

resource "aws_macie2_organization_admin_account" "main" {
  count = var.enable_macie ? 1 : 0

  admin_account_id = data.aws_caller_identity.current.account_id
}

# Inspector for vulnerability scanning
resource "aws_inspector2_enabler" "main" {
  account_ids    = [data.aws_caller_identity.current.account_id]
  resource_types = ["EC2", "ECR_IMAGE", "LAMBDA"]
}

resource "aws_inspector_assessment_target" "main" {
  name = "${var.name_prefix}-inspector-target"

  resource_group_arn = aws_inspector_resource_group.main.arn
}

resource "aws_inspector_resource_group" "main" {
  tags = {
    Name = var.name_prefix
  }
}

resource "aws_inspector_assessment_template" "main" {
  name       = "${var.name_prefix}-inspector-template"
  target_arn = aws_inspector_assessment_target.main.arn

  duration           = 3600
  rules_package_arns = [
    "arn:aws:inspector:us-west-1:357557129151:rulespackage/0-g5BpSrpQ",
    "arn:aws:inspector:us-west-1:357557129151:rulespackage/0-g5Oa1dJP",
    "arn:aws:inspector:us-west-1:357557129151:rulespackage/0-g5R1CpLh",
    "arn:aws:inspector:us-west-1:357557129151:rulespackage/0-g5S1Jr5d",
    "arn:aws:inspector:us-west-1:357557129151:rulespackage/0-gKE0m1dK"
  ]

  event_subscription {
    event = "ASSESSMENT_RUN_COMPLETED"
    topic_arn = aws_sns_topic.inspector_findings.arn
  }
}

# SNS Topic for Inspector findings
resource "aws_sns_topic" "inspector_findings" {
  name = "${var.name_prefix}-inspector-findings"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-inspector-findings"
      Type = "SNS Topic"
    }
  )
}

# Security Groups for application tiers
resource "aws_security_group" "web" {
  name        = "${var.name_prefix}-web-sg"
  description = "Security group for web tier"
  vpc_id      = var.vpc_id

  # HTTP from anywhere
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS from anywhere
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to anywhere
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-web-sg"
      Type = "Security Group"
      Tier = "Web"
    }
  )
}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app-sg"
  description = "Security group for application tier"
  vpc_id      = var.vpc_id

  # From web tier
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  # From ALB
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  # Outbound to anywhere
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-app-sg"
      Type = "Security Group"
      Tier = "Application"
    }
  )
}

# VPC Flow Logs for security monitoring
resource "aws_flow_log" "security" {
  iam_role_arn    = aws_iam_role.flow_log_security.arn
  log_destination = aws_cloudwatch_log_group.flow_log_security.arn
  traffic_type    = "ALL"
  vpc_id          = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-security-flow-log"
      Type = "VPC Flow Log"
    }
  )
}

resource "aws_cloudwatch_log_group" "flow_log_security" {
  name              = "/aws/vpc/flow-logs/${var.name_prefix}-security"
  retention_in_days = 90

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-security-flow-log-group"
      Type = "CloudWatch Log Group"
    }
  )
}

resource "aws_iam_role" "flow_log_security" {
  name = "${var.name_prefix}-flow-log-security-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-flow-log-security-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy" "flow_log_security" {
  name = "${var.name_prefix}-flow-log-security-policy"
  role = aws_iam_role.flow_log_security.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "${aws_cloudwatch_log_group.flow_log_security.arn}:*"
      }
    ]
  })
}
