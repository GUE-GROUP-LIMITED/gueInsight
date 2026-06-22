# Security Policy

## Reporting Security Vulnerabilities

**Please do NOT open public GitHub issues for security vulnerabilities.**

Instead, report security vulnerabilities privately to: **[security@guecyber.com](mailto:security@guecyber.com)**

Include:
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your report within 48 hours and keep you updated on progress.

## Security Standards

GueInsight is designed with security and compliance as core principles:

### Authentication & Authorization
- Passwords are hashed using PBKDF2-SHA256
- Session tokens are signed and HTTP-only
- Admin access is restricted to configured superuser accounts
- Role-based access control (RBAC) for subscribers and staff

### Data Protection
- All personal data is encrypted at rest (when configured for production)
- HTTPS/TLS is required for production deployments
- CORS is restricted to authorized domains only
- CSRF protection on all state-changing operations

### Compliance
- GDPR compliance features: export, deletion, audit trails
- NIS2 incident reporting and tracking
- ISO 27001 control mapping
- EU data residency enforcement (Enterprise Elite)

### Secrets Management
- **NEVER hardcode secrets** in code or configuration files
- Use environment variables for all sensitive data
- Production deployments require `SECRET_KEY` and `SECURITY_PASSWORD_SALT` to be set
- Startup validation fails if critical secrets are missing

### Dependency Security
- Dependencies are regularly updated for security patches
- Critical dependencies are pinned to known-good versions in `requirements.txt`
- Use `pip audit` to check for known vulnerabilities before deployment

## Deployment Security Checklist

Before deploying to production:

- [ ] Set all required environment variables (SECRET_KEY, SECURITY_PASSWORD_SALT, etc.)
- [ ] Use PostgreSQL or other production-grade database (not SQLite)
- [ ] Enable HTTPS/TLS on all endpoints
- [ ] Configure FRONTEND_ORIGINS to allow only trusted domains
- [ ] Set SESSION_COOKIE_SECURE=true and SESSION_COOKIE_HTTPONLY=true
- [ ] Configure email credentials for notifications
- [ ] Enable EU_ONLY_DATA_RESIDENCY if serving EU customers
- [ ] Run database migrations with `flask db upgrade`
- [ ] Set up monitoring and alerting for security events
- [ ] Review CORS settings and security headers

## Security Updates

- We monitor dependency updates regularly
- Security patches are released as needed
- Critical vulnerabilities are addressed within 24 hours
- All security fixes are documented in release notes

## Questions?

For security-related questions (not vulnerabilities), email: [security@guecyber.com](mailto:security@guecyber.com)
