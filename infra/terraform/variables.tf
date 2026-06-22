variable "project_name" {
  description = "Project/application name"
  type        = string
  default     = "gueinsight"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "container_image" {
  description = "Container image URI for the backend service"
  type        = string
}

variable "container_port" {
  description = "Backend container exposed port"
  type        = number
  default     = 5000
}

variable "desired_count" {
  description = "Desired task count"
  type        = number
  default     = 2
}

variable "subnet_ids" {
  description = "Subnet IDs for ECS service networking"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for ECS service networking"
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Whether ECS tasks should receive public IPs"
  type        = bool
  default     = false
}
