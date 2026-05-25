###############################################################################
# Outputs
###############################################################################

output "service_id" {
  description = "VPC Endpoint Service ID. Customers use this with com.amazonaws.vpce."
  value       = aws_vpc_endpoint_service.this.id
}

output "service_name" {
  description = "AWS-issued service name (com.amazonaws.vpce.<region>.<id>). Share this with customers."
  value       = aws_vpc_endpoint_service.this.service_name
}

output "service_dns_entries" {
  description = "Per-AZ private DNS entries the customer can resolve via Route 53 PHZ."
  value       = aws_vpc_endpoint_service.this.private_dns_name
}

output "nlb_arn" {
  description = "NLB ARN — useful when adding listeners or wiring AWS WAF."
  value       = aws_lb.privatelink.arn
}

output "target_group_arn" {
  description = "Target group ARN."
  value       = aws_lb_target_group.privatelink.arn
}
