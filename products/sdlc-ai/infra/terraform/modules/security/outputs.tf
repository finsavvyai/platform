output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.main.key_id
}

output "kms_key_arn" {
  description = "KMS key ARN"
  value       = aws_kms_key.main.arn
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = aws_kms_alias.main.name
}

output "certificate_arn" {
  description = "SSL certificate ARN"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "certificate_domain_name" {
  description = "SSL certificate domain name"
  value       = aws_acm_certificate.main.domain_name
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = aws_wafv2_web_acl.main.id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "shield_protection_id" {
  description = "Shield protection ID"
  value       = var.enable_shield_advanced ? aws_shield_protection.main[0].id : null
}

output "shield_protection_arn" {
  description = "Shield protection ARN"
  value       = var.enable_shield_advanced ? aws_shield_protection.main[0].arn : null
}

output "security_hub_arn" {
  description = "Security Hub ARN"
  value       = var.enable_security_hub ? aws_securityhub_account.main[0].arn : null
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].id : null
}

output "guardduty_detector_status" {
  description = "GuardDuty detector status"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].status : null
}

output "guardduty_publishing_destination_arn" {
  description = "GuardDuty publishing destination ARN"
  value       = var.enable_guardduty ? aws_guardduty_publishing_destination.main[0].destination_arn : null
}

output "guardduty_s3_bucket" {
  description = "S3 bucket for GuardDuty findings"
  value       = var.enable_guardduty ? aws_s3_bucket.guardduty[0].bucket : null
}

output "config_recorder_arn" {
  description = "Config recorder ARN"
  value       = var.enable_config_rules ? aws_config_configuration_recorder.main[0].arn : null
}

output "config_recorder_name" {
  description = "Config recorder name"
  value       = var.enable_config_rules ? aws_config_configuration_recorder.main[0].name : null
}

output "config_s3_bucket" {
  description = "S3 bucket for Config"
  value       = var.enable_config_rules ? aws_s3_bucket.config[0].bucket : null
}

output "macie_account_id" {
  description = "Macie account ID"
  value       = var.enable_macie ? aws_macie2_account.main[0].id : null
}

output "macie_status" {
  description = "Macie status"
  value       = var.enable_macie ? aws_macie2_account.main[0].status : null
}

output "inspector_assessment_target_arn" {
  description = "Inspector assessment target ARN"
  value       = aws_inspector_assessment_target.main.arn
}

output "inspector_assessment_template_arn" {
  description = "Inspector assessment template ARN"
  value       = aws_inspector_assessment_template.main.arn
}

output "inspector_findings_sns_topic_arn" {
  description = "SNS topic ARN for Inspector findings"
  value       = aws_sns_topic.inspector_findings.arn
}

output "web_security_group_id" {
  description = "Web tier security group ID"
  value       = aws_security_group.web.id
}

output "app_security_group_id" {
  description = "Application tier security group ID"
  value       = aws_security_group.app.id
}

output "security_flow_log_id" {
  description = "Security flow log ID"
  value       = aws_flow_log_security.id
}

output "security_flow_log_group" {
  description = "Security flow log CloudWatch group name"
  value       = aws_cloudwatch_log_group.flow_log_security.name
}
