# Terraform Baseline (ECS/Fargate)

This directory provides a baseline Infrastructure-as-Code setup for gueInsight using Terraform.

## What it provisions

- ECS cluster
- Fargate task definition and service
- CloudWatch log group
- Deployment circuit breaker with rollback enabled

## Required inputs

- `container_image`: a pushed backend image URI (for example from GHCR or ECR)
- `subnet_ids`: list of subnet IDs for ECS networking
- `security_group_ids`: list of security group IDs for ECS tasks

## Important follow-up

Before applying:

1. Provide VPC subnet IDs and security group IDs.
2. Add a load balancer and target group.
3. Inject runtime secrets using AWS Secrets Manager or SSM Parameter Store.
4. Configure remote Terraform state and locking.

## Example usage

```bash
cd infra/terraform
terraform init
terraform plan \
	-var="container_image=ghcr.io/your-org/gueinsight:latest" \
	-var='subnet_ids=["subnet-12345678"]' \
	-var='security_group_ids=["sg-12345678"]'
```
