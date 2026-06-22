# Organization Alignment Checklist

This checklist tracks alignment of GueInsight with Gue Cyber organizational standards as of June 22, 2026.

## Repository Governance

- [x] Repository moved to `GUE-GROUP-LIMITED` organization
- [x] Remote URL updated to organization repository
- [x] Branch protection rules configured on `main` branch
- [x] Code ownership documented (CODEOWNERS file recommended)
- [ ] CI/CD pipeline configured (GitHub Actions)
- [ ] Status checks required before merge

## Domains & Environment

- [x] All production endpoints use `guecyber.com` or `insights.guecyber.com` domain
- [x] Personal Vercel preview URLs removed from CORS configuration
- [x] `.env.example` uses company domains and email addresses
- [x] Production API endpoint: `https://api.insights.guecyber.com`
- [x] Frontend origin: `https://insights.guecyber.com`

## Security & Configuration

- [x] Hardened config.py with required environment variable validation
- [x] Removed "change-this-*" placeholder defaults
- [x] `SECRET_KEY` and `SECURITY_PASSWORD_SALT` are now required (fail on startup if missing)
- [x] Updated `.env.example` with production-safe placeholders
- [x] Added SECURITY.md with vulnerability reporting process
- [x] Email sender uses `noreply@guecyber.com` instead of `.local` domain

## Documentation

- [x] README.md updated with company branding
- [x] Removed personal contributor credits (Gabriel Aloho)
- [x] Added company description and contact information
- [x] CONTRIBUTING.md created with contribution guidelines
- [ ] frontend/README.md updated with product focus
- [ ] Deployment guides reference company infrastructure

## GitHub Organization Setup

- [x] Repository transferred to organization
- [x] CONTRIBUTING.md added
- [x] SECURITY.md added
- [x] .github/pull_request_template.md created
- [x] .github/issue_template.md created
- [x] CHANGELOG.md created
- [ ] Branch protection: require pull request reviews (minimum 2)
- [ ] Branch protection: require status checks to pass
- [ ] Branch protection: dismiss stale pull request approvals
- [ ] Require signed commits (optional, recommended)

## Compliance & Legal

- [ ] LICENSE file reviewed and updated (MIT → company standard if needed)
- [ ] CODE_OF_CONDUCT.md created or linked to organization standard
- [ ] Data processing agreements (DPA) documented
- [ ] GDPR compliance documentation updated
- [ ] NIS2 compliance matrix reviewed

## Deployment & Operations

- [ ] Production environment uses hardened config
- [ ] Staging environment configured separately
- [ ] Database backup procedures documented
- [ ] Disaster recovery plan in place
- [ ] Monitoring and alerting configured
- [ ] Incident response playbook created

## Communication

- [ ] Support email: support@guecyber.com
- [ ] Security contact: security@guecyber.com
- [ ] Legal contact: [to be determined]
- [ ] Product owner identified and listed in README
- [ ] Slack channel created for development team

## Next Steps (Recommended)

1. **CI/CD Pipeline**: Set up GitHub Actions for automated testing and deployment
2. **Branch Protection**: Enable required reviews and status checks
3. **Monitoring**: Configure error tracking (Sentry) and performance monitoring
4. **Documentation**: Complete frontend README and deployment guides
5. **Legal Review**: Have company legal review LICENSE and data handling policies

---

**Last Updated:** 2026-06-22  
**Maintained By:** Gue Cyber Development Team  
**Status:** ✅ Core alignment complete (deployment infrastructure pending)
