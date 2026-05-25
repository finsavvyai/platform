# Production EKS Cluster Configuration
resource "aws_eks_cluster" "production" {
  name     = "quantumbeam-production"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids = concat(
      aws_subnet.private[*].id,
      aws_subnet.public[*].id
    )
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.eks_public_access_cidrs
  }

  kubernetes_network_config {
    service_ipv4_cidr = var.kubernetes_service_cidr
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = [
      "secrets",
      "configmaps",
      "pv",
      "pvc",
      "etcd",
      "storageclasses"
    ]
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_controller_policy,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-cluster"
      Environment = "production"
      Type = "kubernetes-cluster"
    }
  )
}

# EKS Node Groups
resource "aws_eks_node_group" "system_nodes" {
  cluster_name    = aws_eks_cluster.production.name
  node_group_name = "system-nodes"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.system_nodes_desired_size
    max_size     = var.system_nodes_max_size
    min_size     = var.system_nodes_min_size
  }

  instance_types = [var.system_nodes_instance_type]

  ami_type       = "AL2_x86_64"
  capacity_type  = "ON_DEMAND"

  update_config {
    max_unavailable_percentage = 33
  }

  remote_access {
    ec2_ssh_key               = var.ssh_key_name
    source_security_group_ids = [aws_security_group.bastion.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-system-nodes"
      Environment = "production"
      Type = "kubernetes-node-group"
      Role = "system"
    }
  )
}

resource "aws_eks_node_group" "application_nodes" {
  cluster_name    = aws_eks_cluster.production.name
  node_group_name = "application-nodes"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.application_nodes_desired_size
    max_size     = var.application_nodes_max_size
    min_size     = var.application_nodes_min_size
  }

  instance_types = var.application_nodes_instance_types

  ami_type       = "AL2_x86_64"
  capacity_type  = "ON_DEMAND"

  update_config {
    max_unavailable_percentage = 33
  }

  remote_access {
    ec2_ssh_key               = var.ssh_key_name
    source_security_group_ids = [aws_security_group.bastion.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-application-nodes"
      Environment = "production"
      Type = "kubernetes-node-group"
      Role = "application"
    }
  )
}

resource "aws_eks_node_group" "ai_ml_nodes" {
  cluster_name    = aws_eks_cluster.production.name
  node_group_name = "ai-ml-nodes"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.ai_ml_nodes_desired_size
    max_size     = var.ai_ml_nodes_max_size
    min_size     = var.ai_ml_nodes_min_size
  }

  instance_types = var.ai_ml_nodes_instance_types

  ami_type       = "AL2_x86_64"
  capacity_type  = "ON_DEMAND"

  update_config {
    max_unavailable_percentage = 33
  }

  remote_access {
    ec2_ssh_key               = var.ssh_key_name
    source_security_group_ids = [aws_security_group.bastion.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ai-ml-nodes"
      Environment = "production"
      Type = "kubernetes-node-group"
      Role = "ai-ml"
    }
  )
}

resource "aws_eks_node_group" "spot_nodes" {
  cluster_name    = aws_eks_cluster.production.name
  node_group_name = "spot-nodes"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.spot_nodes_desired_size
    max_size     = var.spot_nodes_max_size
    min_size     = 0
  }

  instance_types = var.spot_nodes_instance_types

  ami_type       = "AL2_x86_64"
  capacity_type  = "SPOT"

  update_config {
    max_unavailable_percentage = 100
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-spot-nodes"
      Environment = "production"
      Type = "kubernetes-node-group"
      Role = "spot"
    }
  )
}

# IAM Roles
resource "aws_iam_role" "eks_cluster" {
  name = "quantumbeam-production-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-cluster-role"
    }
  )
}

resource "aws_iam_role" "eks_node" {
  name = "quantumbeam-production-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-node-role"
    }
  )
}

# IAM Role Policies
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_controller_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node.name
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent_policy" {
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  role       = aws_iam_role.eks_node.name
}

# KMS Key for EKS Encryption
resource "aws_kms_key" "eks" {
  description             = "EKS cluster encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow access for EKS"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-kms-key"
      Type = "encryption-key"
      Service = "eks"
    }
  )
}

resource "aws_kms_alias" "eks" {
  name          = "alias/quantumbeam-production-eks"
  target_key_id = aws_kms_key.eks.key_id
}

# EKS Add-ons
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.production.name
  addon_name   = "vpc-cni"
  addon_version = var.vpc_cni_version

  resolve_conflicts = "OVERWRITE"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-vpc-cni"
    }
  )
}

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.production.name
  addon_name   = "coredns"
  addon_version = var.coredns_version

  resolve_conflicts = "OVERWRITE"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-coredns"
    }
  )
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.production.name
  addon_name   = "kube-proxy"
  addon_version = var.kube_proxy_version

  resolve_conflicts = "OVERWRITE"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-kube-proxy"
    }
  )
}

resource "aws_eks_addon" "aws_ebs_csi_driver" {
  cluster_name = aws_eks_cluster.production.name
  addon_name   = "aws-ebs-csi-driver"
  addon_version = var.ebs_csi_version

  resolve_conflicts = "OVERWRITE"

  service_account_role_arn = aws_iam_role.ebs_csi_driver.arn

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ebs-csi-driver"
    }
  )
}

# EBS CSI Driver IAM Role
resource "aws_iam_role" "ebs_csi_driver" {
  name = "quantumbeam-production-ebs-csi-driver"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", ""):sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          }
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ebs-csi-driver-role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "ebs_csi_driver_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = aws_iam_role.ebs_csi_driver.name
}

# OIDC Provider
resource "aws_iam_openid_connect_provider" "eks" {
  url = aws_eks_cluster.production.identity[0].oidc[0].issuer

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
}

data "tls_certificate" "eks" {
  url = aws_eks_cluster.production.identity[0].oidc[0].issuer
}