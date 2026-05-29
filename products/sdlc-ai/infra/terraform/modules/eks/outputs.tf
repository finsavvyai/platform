output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_platform_version" {
  description = "EKS cluster platform version"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_status" {
  description = "EKS cluster status"
  value       = aws_eks_cluster.main.status
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "cluster_oidc_issuer_url" {
  description = "EKS cluster OIDC issuer URL"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_oidc_provider_arn" {
  description = "EKS cluster OIDC provider ARN"
  value       = aws_iam_oidc_provider.main.arn
}

output "worker_iam_role_arn" {
  description = "Worker node IAM role ARN"
  value       = aws_iam_role.node.arn
}

output "worker_iam_role_name" {
  description = "Worker node IAM role name"
  value       = aws_iam_role.node.name
}

output "worker_security_group_id" {
  description = "Worker node security group ID"
  value       = aws_security_group.node.id
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = aws_security_group.cluster.id
}

output "node_group_name" {
  description = "EKS node group name"
  value       = aws_eks_node_group.main.node_group_name
}

output "node_group_arn" {
  description = "EKS node group ARN"
  value       = aws_eks_node_group.main.arn
}

output "node_group_status" {
  description = "EKS node group status"
  value       = aws_eks_node_group.main.status
}

output "cluster_autoscaler_role_arn" {
  description = "Cluster autoscaler IAM role ARN"
  value       = aws_iam_role.cluster_autoscaler.arn
}

output "vpc_cni_role_arn" {
  description = "VPC CNI IAM role ARN"
  value       = aws_iam_role.vpc_cni.arn
}

output "ebs_csi_role_arn" {
  description = "EBS CSI driver IAM role ARN"
  value       = aws_iam_role.ebs_csi.arn
}

output "kubeconfig" {
  description = "Kubeconfig for the EKS cluster"
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
            - --region
            - ${var.aws_region}
            - eks
            - get-token
            - --cluster-name
            - ${aws_eks_cluster.main.name}
  EOT

  sensitive = true
}
