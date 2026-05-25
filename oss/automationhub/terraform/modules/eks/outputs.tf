# EKS Module Outputs

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_arn" {
  description = "The Amazon Resource Name (ARN) of the cluster"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "The endpoint for the EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_id" {
  description = "The ID of the EKS cluster"
  value       = aws_eks_cluster.main.id
}

output "cluster_status" {
  description = "The status of the EKS cluster"
  value       = aws_eks_cluster.main.status
}

output "cluster_identity_oidc_issuer" {
  description = "The OIDC identity issuer for the cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_identity_oidc_issuer_arn" {
  description = "The OIDC identity issuer ARN for the cluster"
  value       = aws_iam_openid_connect_provider.main.arn
}

output "kms_key_id" {
  description = "The KMS key ID for cluster encryption"
  value       = aws_kms_key.cluster.key_id
}

output "kms_key_arn" {
  description = "The KMS key ARN for cluster encryption"
  value       = aws_kms_key.cluster.arn
}

output "node_groups" {
  description = "Map of node groups and their attributes"
  value = {
    for key, ng in aws_eks_node_group.managed : key => {
      id           = ng.id
      arn          = ng.arn
      status       = ng.status
      version      = ng.version
      resources    = ng.resources
      role_arn     = ng.node_role_arn
      scaling_config = ng.scaling_config
    }
  }
}

output "cluster_autoscaler_role_arn" {
  description = "ARN of the IAM role for cluster autoscaler"
  value       = aws_iam_role.cluster_autoscaler.arn
}

output "lb_controller_role_arn" {
  description = "ARN of the IAM role for load balancer controller"
  value       = aws_iam_role.load_balancer_controller.arn
}

output "external_dns_role_arn" {
  description = "ARN of the IAM role for external DNS"
  value       = aws_iam_role.external_dns.arn
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster control plane"
  value       = aws_security_group.cluster.id
}

output "node_security_group_id" {
  description = "Security group ID attached to the EKS worker nodes"
  value       = aws_security_group.nodes.id
}

output "node_group_arns" {
  description = "List of ARNs of managed node groups"
  value       = [for ng in aws_eks_node_group.managed : ng.arn]
}

output "node_group_ids" {
  description = "List of IDs of managed node groups"
  value       = [for ng in aws_eks_node_group.managed : ng.id]
}

output "kubeconfig" {
  description = "kubectl configuration file"
  value       = <<-EOT
    apiVersion: v1
    clusters:
    - cluster:
        server: ${aws_eks_cluster.main.endpoint}
        certificate-authority-data: ${aws_eks_cluster.main.certificate_authority[0].data}
      name: ${aws_eks_cluster.main.arn}
    contexts:
    - context:
        cluster: ${aws_eks_cluster.main.arn}
        user: ${aws_eks_cluster.main.arn}
      name: ${aws_eks_cluster.main.arn}
    current-context: ${aws_eks_cluster.main.arn}
    kind: Config
    preferences: {}
    users:
    - name: ${aws_eks_cluster.main.arn}
      user:
        exec:
          apiVersion: client.authentication.k8s.io/v1beta1
          command: aws
          args:
            - "eks"
            - "get-token"
            - "--cluster-name"
            - "${aws_eks_cluster.main.name}"
            - "--region"
            - "${var.region}"
  EOT

  sensitive = true
}