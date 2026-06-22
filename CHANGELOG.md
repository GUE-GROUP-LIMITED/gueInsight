# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- GueInsight platform migration to organization repository
- Hardened configuration with required security environment variables
- Standardized README and project governance documentation

### Changed
- Production API endpoint now uses `api.insights.guecyber.com` subdomain
- CORS allowlist restricted to company domains only
- Email default sender uses `guecyber.com` domain
- Configuration validation at startup for critical secrets

### Security
- Removed personal Vercel preview URLs from CORS configuration
- Enforced `SECRET_KEY` and `SECURITY_PASSWORD_SALT` as required environment variables
- Updated documentation with security best practices

---

## Versioning

When releasing new versions, follow [Semantic Versioning](https://semver.org/):

- **MAJOR** — Breaking API changes or major features
- **MINOR** — New features (backward compatible)
- **PATCH** — Bug fixes and minor improvements

Example: `v1.2.3`

### Release Process

1. Create a release branch: `git checkout -b release/v1.2.3`
2. Update version numbers in `package.json` (frontend) and `__init__.py` (backend)
3. Update this CHANGELOG.md with changes under new version section
4. Create pull request and merge to `main`
5. Tag the commit: `git tag v1.2.3`
6. Push tag: `git push origin v1.2.3`
7. Create release notes on GitHub with deployment instructions

---

## Notes for Maintainers

- Keep this file updated with all user-facing changes
- Focus on what changed for end users, not internal refactoring
- Include security fixes prominently
- Reference GitHub issues where applicable (e.g., "Fixes #42")
