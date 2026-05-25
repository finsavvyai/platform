# PrivateLink Terraform Module

BEAT-PLAN S3.3. Reachable-without-the-public-internet for regulated buyers.

## Producer side (sdlc.ai operator)

```hcl
module "privatelink" {
  source = "../modules/privatelink"

  name                = "gateway"
  vpc_id              = aws_vpc.platform.id
  subnet_ids          = module.platform_vpc.private_subnet_ids
  target_ip_addresses = data.aws_network_interfaces.gateway_eni.private_ips

  allowed_principals = [
    "arn:aws:iam::111111111111:root",  # customer 1
    "arn:aws:iam::222222222222:root",  # customer 2
  ]
}

output "privatelink_service_name" {
  value = module.privatelink.service_name
}
```

Apply, then share `module.privatelink.service_name` with the customer.

## Consumer side (customer operator)

```hcl
module "sdlc_privatelink" {
  source       = "git::https://github.com/finsavvyai/sdlc-platform.git//deployments/terraform/modules/privatelink"
  consumer     = true
  service_name = "com.amazonaws.vpce.us-east-1.vpce-svc-0abc123def"  # from producer

  vpc_id             = data.aws_vpc.this.id
  subnet_ids         = data.aws_subnets.private.ids
  security_group_ids = [aws_security_group.sdlc_pl.id]

  tags = { Project = "sdlc-platform" }
}
```

Then create a Route 53 Private Hosted Zone for `*.sdlc.ai` pointing at the
endpoint's DNS names. Outbound traffic from the customer VPC to
`*.sdlc.ai` now resolves to a private IP and never crosses the public
internet.

## Acceptance flow

`acceptance_required = true` (default) means each consumer endpoint
sits in `pendingAcceptance` until the operator runs:

```bash
aws ec2 accept-vpc-endpoint-connections \
  --service-id $(terraform output -raw service_id) \
  --vpc-endpoint-ids vpce-09abcd...
```

For closed-procurement contracts the operator inspects which AWS account
created the endpoint before accepting.
