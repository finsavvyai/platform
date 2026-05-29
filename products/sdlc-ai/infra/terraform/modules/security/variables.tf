variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "alb_security_group_id" {
  type        = string
  description = "Security group ID for Application Load Balancer"
}

variable "domain_name" {
  type        = string
  description = "Primary domain name"
}

variable "enable_shield_advanced" {
  type        = bool
  description = "Enable Shield Advanced protection"
  default     = true
}

variable "enable_security_hub" {
  type        = bool
  description = "Enable Security Hub"
  default     = true
}

variable "enable_guardduty" {
  type        = bool
  description = "Enable GuardDuty"
  default     = true
}

variable "enable_config_rules" {
  type        = bool
  description = "Enable AWS Config rules"
  default     = true
}

variable "enable_macie" {
  type        = bool
  description = "Enable Amazon Macie"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources"
  default     = {}
}
