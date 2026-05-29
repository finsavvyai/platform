# EKS Cluster Module for SDLC.ai Platform
# Creates a secure, scalable EKS cluster with managed node groups

data "aws_iam_policy_document" "cluster_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# EKS Cluster IAM Role
resource "aws_iam_role" "cluster" {
  name = "${var.name_prefix}-eks-cluster-role"

  assume_role_policy = data.aws_iam_policy_document.cluster_assume_role.json

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-eks-cluster-role"
      Type = "IAM Role"
    }
  )
}

# EKS Cluster IAM Policy
resource "aws_iam_role_policy_attachment" "cluster_aws_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

# EKS VPC Resource Controller
resource "aws_iam_role_policy_attachment" "cluster_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.cluster.name
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids = concat(var.private_subnet_ids, var.public_subnet_ids)
    endpoint_public_access = false
    endpoint_private_access = true
    public_access_cidrs     = []

    security_group_ids = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = var.enabled_cluster_log_types

  encryption_config {
    provider {
      key_arn = var.kms_key_arn
    }
    resources = ["secrets"]
  }

  tags = merge(
    var.tags,
    {
      Name = var.cluster_name
      Type = "EKS Cluster"
    }
  )

  depends_on = [
    aws_iam_role_policy_attachment.cluster_aws_policy,
    aws_iam_role_policy_attachment.cluster_vpc_resource_controller
  ]
}

# EKS Cluster Security Group
resource "aws_security_group" "cluster" {
  name        = "${var.name_prefix}-eks-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = var.vpc_id

  # Allow Node-to-Cluster communication
  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    security_groups = [aws_security_group.node.id]
  }

  # Allow API server to communicate with pods
  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    security_groups = [aws_security_group.node.id]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-eks-cluster-sg"
      Type = "Security Group"
    }
  )
}

# EKS Node IAM Role
resource "aws_iam_role" "node" {
  name = "${var.name_prefix}-eks-node-role"

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
    var.tags,
    {
      Name = "${var.name_prefix}-eks-node-role"
      Type = "IAM Role"
    }
  )
}

# EKS Node IAM Policy Attachments
resource "aws_iam_role_policy_attachment" "node_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_autoscaling_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AutoScalingFullAccess"
  role       = aws_iam_role.node.name
}

# EKS Node Security Group
resource "aws_security_group" "node" {
  name        = "${var.name_prefix}-eks-node-sg"
  description = "Security group for EKS nodes"
  vpc_id      = var.vpc_id

  # Allow pods to communicate with the cluster API server
  egress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    security_groups = [aws_security_group.cluster.id]
  }

  # Allow inter-node communication
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  # Allow outbound traffic
  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-eks-node-sg"
      Type = "Security Group"
      "kubernetes.io/cluster/${var.cluster_name}" = "owned"
    }
  )
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.name_prefix}-node-group"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = var.desired_size
    max_size     = var.max_size
    min_size     = var.min_size
  }

  instance_types = var.instance_types

  ami_type = "AL2_x86_64"

  disk_size = var.disk_size

  remote_access {
    ec2_ssh_key               = var.ssh_key_name
    source_security_group_ids = [aws_security_group.bastion.id]
  }

  update_config {
    max_unavailable_percentage = 33
  }

  health_check {
    unhealthy_threshold = 2
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_node_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_container_registry_policy,
    aws_iam_role_policy_attachment.node_autoscaling_policy
  ]

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-eks-node-group"
      Type = "EKS Node Group"
      "kubernetes.io/cluster/${var.cluster_name}" = "owned"
    }
  )
}

# Kubernetes Provider Configuration
data "aws_eks_cluster" "cluster" {
  name = aws_eks_cluster.main.name
}

data "aws_eks_cluster_auth" "cluster" {
  name = aws_eks_cluster.main.name
}

# Kubernetes ConfigMap for aws-auth
resource "kubernetes_config_map_v1_data" "aws_auth" {
  manifest = {
    "apiVersion" = "v1"
    "kind" = "ConfigMap"
    "metadata" = {
      "name" = "aws-auth"
      "namespace" = "kube-system"
    }
    "data" = {
      "mapRoles" = yamlencode([
        {
          "rolearn" = aws_iam_role.node.arn
          "username" = "system:node:{{EC2PrivateDNSName}}"
          "groups" = [
            "system:bootstrappers",
            "system:nodes"
          ]
        },
        {
          "rolearn" = var.bastion_role_arn
          "username" = "bastion"
          "groups" = [
            "system:masters"
          ]
        }
      ])
      "mapUsers" = yamlencode(var.map_users)
    }
  }

  depends_on = [aws_eks_node_group.main]
}

# IAM OIDC Provider for EKS
resource "aws_iam_oidc_provider" "main" {
  client_id_list  = ["sts.amazonaws.com"]
  provider_name   = replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-eks-oidc-provider"
      Type = "IAM OIDC Provider"
    }
  )
}

# EKS Add-ons
resource "aws_eks_addon" "vpc_cni" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "vpc-cni"
  addon_version            = var.vpc_cni_version
  resolve_conflicts        = "OVERWRITE"
  service_account_role_arn = aws_iam_role.vpc_cni.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-vpc-cni-addon"
    }
  )
}

resource "aws_iam_role" "vpc_cni" {
  name = "${var.name_prefix}-vpc-cni-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_oidc_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_oidc_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:aws-node"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-vpc-cni-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "vpc_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.vpc_cni.name
}

resource "aws_eks_addon" "coredns" {
  cluster_name      = aws_eks_cluster.main.name
  addon_name        = "coredns"
  addon_version     = var.coredns_version
  resolve_conflicts = "OVERWRITE"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-coredns-addon"
    }
  )
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name      = aws_eks_cluster.main.name
  addon_name        = "kube-proxy"
  addon_version     = var.kube_proxy_version
  resolve_conflicts = "OVERWRITE"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-kube-proxy-addon"
    }
  )
}

resource "aws_eks_addon" "aws_ebs_csi_driver" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = var.ebs_csi_version
  resolve_conflicts        = "OVERWRITE"
  service_account_role_arn = aws_iam_role.ebs_csi.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-ebs-csi-addon"
    }
  )
}

resource "aws_iam_role" "ebs_csi" {
  name = "${var.name_prefix}-ebs-csi-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_oidc_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_oidc_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-ebs-csi-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy" "ebs_csi" {
  name = "${var.name_prefix}-ebs-csi-policy"
  role = aws_iam_role.ebs_csi.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateSnapshot",
          "ec2:AttachVolume",
          "ec2:DetachVolume",
          "ec2:ModifyVolume",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeInstances",
          "ec2:DescribeSnapshots",
          "ec2:DescribeTags",
          "ec2:DescribeVolumes",
          "ec2:DescribeVolumesModifications",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:CreateVolume",
          "ec2:DeleteVolume",
          "ec2:CreateSnapshot"
        ]
        Resource = "*"
      }
    ]
  })
}

# Cluster Autoscaler
resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  version    = var.cluster_autoscaler_version

  set {
    name  = "autoDiscovery.clusterName"
    value = aws_eks_cluster.main.name
  }

  set {
    name  = "awsRegion"
    value = var.aws_region
  }

  set {
    name  = "rbac.create"
    value = true
  }

  set {
    name  = "rbac.serviceAccount.create"
    value = true
  }

  set {
    name  = "rbac.serviceAccount.name"
    value = "cluster-autoscaler"
  }

  set {
    name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.cluster_autoscaler.arn
  }

  depends_on = [
    kubernetes_config_map_v1_data.aws_auth
  ]
}

resource "aws_iam_role" "cluster_autoscaler" {
  name = "${var.name_prefix}-cluster-autoscaler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_oidc_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_oidc_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-cluster-autoscaler-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  name = "${var.name_prefix}-cluster-autoscaler-policy"
  role = aws_iam_role.cluster_autoscaler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:DescribeInstanceTypes",
          "eks:DescribeNodegroup"
        ]
        Resource = "*"
      }
    ]
  })
}

# Metrics Server
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = var.metrics_server_version

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls"
  }

  depends_on = [
    kubernetes_config_map_v1_data.aws_auth
  ]
}
