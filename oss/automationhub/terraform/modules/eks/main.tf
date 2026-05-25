# EKS Module for UPM.Plus AutomationHub
# Creates a complete EKS cluster with managed node groups

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids = concat(var.private_subnets, var.public_subnets)
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.public_access_cidrs
  }

  enabled_cluster_log_types = var.enabled_cluster_log_types

  encryption_config {
    provider {
      key_arn = aws_kms_key.cluster.arn
    }
    resources = var.encryption_resources
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-cluster"
  })
}

# KMS Key for Cluster Encryption
resource "aws_kms_key" "cluster" {
  description             = "EKS cluster secret encryption key"
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
        Sid    = "Allow EKS to use the key"
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

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-kms-key"
  })
}

resource "aws_kms_alias" "cluster" {
  name          = "alias/${var.environment}-upm-plus-eks"
  target_key_id = aws_kms_key.cluster.key_id
}

# IAM Role for EKS Cluster
resource "aws_iam_role" "cluster" {
  name = "${var.environment}-upm-plus-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-cluster-role"
  })
}

resource "aws_iam_role_policy_attachment" "cluster_amazon_eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

resource "aws_iam_role_policy_attachment" "cluster_amazon_eks_service_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.cluster.name
}

# OIDC Provider for EKS
resource "aws_iam_openid_connect_provider" "main" {
  client_id_list  = ["sts.amazonaws.com"]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  thumbprint_list = data.tls_certificate.cluster.certificates[*].sha1_fingerprint
}

data "tls_certificate" "cluster" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

data "aws_caller_identity" "current" {}

# EKS Managed Node Groups
resource "aws_eks_node_group" "managed" {
  for_each = var.node_groups

  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.environment}-${each.key}-nodes"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = var.private_subnets

  scaling_config {
    desired_size = each.value.desired_capacity
    max_size     = each.value.max_capacity
    min_size     = each.value.min_capacity
  }

  instance_types = each.value.instance_types != null ? each.value.instance_types : [each.value.instance_type]

  ami_type       = each.value.ami_type != null ? each.value.ami_type : var.managed_node_group_defaults.ami_type
  disk_size      = each.value.disk_size != null ? each.value.disk_size : var.managed_node_group_defaults.disk_size
  capacity_type  = each.value.capacity_type != null ? each.value.capacity_type : "ON_DEMAND"

  remote_access {
    ec2_ssh_key               = var.ssh_key_name
    source_security_group_ids = [aws_security_group.nodes.id]
  }

  update_config {
    max_unavailable_percentage = 33
  }

  labels = merge(
    var.managed_node_group_defaults.k8s_labels,
    each.value.k8s_labels
  )

  taints = each.value.taints

  depends_on = [
    aws_iam_role_policy_attachment.nodes_amazon_eks_worker_node_policy,
    aws_iam_role_policy_attachment.nodes_amazon_eks_cni_policy,
    aws_iam_role_policy_attachment.nodes_amazon_ec2_container_registry_readonly,
  ]

  tags = merge(
    var.tags,
    each.value.additional_tags,
    {
      Name = "${var.environment}-upm-plus-${each.key}-node-group"
      "k8s.io/cluster-autoscaler/enabled" = "true"
      "k8s.io/cluster-autoscaler/${aws_eks_cluster.main.name}" = "true"
    }
  )
}

# IAM Role for Node Groups
resource "aws_iam_role" "nodes" {
  name = "${var.environment}-upm-plus-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-node-role"
  })
}

resource "aws_iam_role_policy_attachment" "nodes_amazon_eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.nodes.name
}

resource "aws_iam_role_policy_attachment" "nodes_amazon_eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.nodes.name
}

resource "aws_iam_role_policy_attachment" "nodes_amazon_ec2_container_registry_readonly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.nodes.name
}

# Additional policies for node groups
resource "aws_iam_role_policy" "nodes_additional" {
  name = "${var.environment}-upm-plus-eks-node-additional-policy"
  role = aws_iam_role.nodes.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags",
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "ec2:CreateTags",
          "ec2:DeleteTags"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::upm-plus-*",
          "arn:aws:s3:::upm-plus-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for Nodes
resource "aws_security_group" "nodes" {
  name_prefix = "${var.environment}-upm-plus-eks-node-sg-"
  vpc_id      = var.vpc_id

  # Allow node-to-node communication
  ingress {
    description = "Node to node communication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # Allow pods to communicate with the cluster API Server
  ingress {
    description = "Allow pods to communicate with the cluster API Server"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.cluster_endpoint_public_access_cidr]
  }

  # Allow outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-node-sg"
  })
}

# Security Group for Cluster API
resource "aws_security_group" "cluster" {
  name_prefix = "${var.environment}-upm-plus-eks-cluster-sg-"
  vpc_id      = var.vpc_id

  # Allow API Server to receive communication from nodes
  ingress {
    description = "Allow API Server to receive communication from nodes"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.nodes.id]
  }

  # Allow API Server to receive communication from control plane
  ingress {
    description = "Allow API Server to receive communication from control plane"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.cluster_endpoint_public_access_cidrs
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-cluster-sg"
  })
}

# IAM Roles for Kubernetes Service Accounts
resource "aws_iam_role" "cluster_autoscaler" {
  name = "${var.environment}-upm-plus-eks-cluster-autoscaler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-cluster-autoscaler-role"
  })
}

resource "aws_iam_policy" "cluster_autoscaler" {
  name        = "${var.environment}-upm-plus-eks-cluster-autoscaler-policy"
  description = "Policy for cluster autoscaler"

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
          "ec2:DescribeImages",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions",
          "eks:DescribeNodegroup"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
  role       = aws_iam_role.cluster_autoscaler.name
}

resource "aws_iam_role" "load_balancer_controller" {
  name = "${var.environment}-upm-plus-eks-load-balancer-controller"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-load-balancer-controller-role"
  })
}

resource "aws_iam_policy" "load_balancer_controller" {
  name        = "${var.environment}-upm-plus-eks-load-balancer-controller-policy"
  description = "Policy for AWS Load Balancer Controller"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:CreateServiceLinkedRole",
          "ec2:DescribeAccountAttributes",
          "ec2:DescribeAddresses",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeVpcs",
          "ec2:DescribeVpcPeeringConnections",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeTags",
          "ec2:GetCoipPoolUsage",
          "ec2:DescribeCoipPools",
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeLoadBalancerAttributes",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeListenerCertificates",
          "elasticloadbalancing:DescribeSSLPolicies",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetGroupAttributes",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeTags",
          "elasticloadbalancing:CreateListener",
          "elasticloadbalancing:DeleteListener",
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:ModifyTargetGroupAttributes",
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets",
          "elasticloadbalancing:SetLoadBalancerPoliciesOfListener",
          "elasticloadbalancing:AddTags",
          "elasticloadbalancing:RemoveTags",
          "elasticloadbalancing:ModifyLoadBalancerAttributes",
          "elasticloadbalancing:SetIpAddressType",
          "elasticloadbalancing:SetSecurityGroups",
          "elasticloadbalancing:SetSubnets",
          "elasticloadbalancing:DeleteLoadBalancer",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:DescribeUserPoolClient",
          "acm:ListCertificates",
          "acm:DescribeCertificate",
          "iam:ListServerCertificates",
          "iam:GetServerCertificate",
          "waf-regional:GetWebACLForResource",
          "waf-regional:GetWebACL",
          "waf-regional:AssociateWebACL",
          "waf-regional:DisassociateWebACL",
          "wafv2:GetWebACLForResource",
          "wafv2:GetWebACL",
          "wafv2:AssociateWebACL",
          "wafv2:DisassociateWebACL",
          "shield:GetSubscriptionState",
          "shield:DescribeProtection",
          "shield:CreateProtection",
          "shield:DeleteProtection"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "load_balancer_controller" {
  policy_arn = aws_iam_policy.load_balancer_controller.arn
  role       = aws_iam_role.load_balancer_controller.name
}

resource "aws_iam_role" "external_dns" {
  name = "${var.environment}-upm-plus-eks-external-dns"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.main.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.main.url, "https://", ""):sub" = "system:serviceaccount:kube-system:external-dns"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-eks-external-dns-role"
  })
}

resource "aws_iam_policy" "external_dns" {
  name        = "${var.environment}-upm-plus-eks-external-dns-policy"
  description = "Policy for External DNS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
          "route53:ListHostedZones"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_dns" {
  policy_arn = aws_iam_policy.external_dns.arn
  role       = aws_iam_role.external_dns.name
}

# Kubernetes Provider Configuration (for additional resources)
data "aws_eks_cluster_auth" "main" {
  name = aws_eks_cluster.main.name
}

# Wait for cluster to be ready
resource "null_resource" "wait_for_cluster" {
  depends_on = [aws_eks_node_group.managed]

  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --name ${aws_eks_cluster.main.name} --region ${var.region}"
  }
}