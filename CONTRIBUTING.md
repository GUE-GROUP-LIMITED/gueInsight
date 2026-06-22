# Contributing to GueInsight

Thank you for your interest in contributing to GueInsight! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

This project adheres to the Gue Cyber Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@guecyber.com](mailto:conduct@guecyber.com).

## Getting Started

1. **Fork the repository** on GitHub (for external contributors)
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/GUE-GROUP-LIMITED/gueInsight.git
   cd gueInsight
   ```
3. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Code Standards

- **Python**: Follow [PEP 8](https://pep8.org/) guidelines
- **JavaScript/React**: Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **Commits**: Use clear, descriptive messages (e.g., `feat: add NIS2 incident reporting`, `fix: resolve CORS issue`)
- **Linting**: Run `eslint` for frontend and format Python code with `black`

### Testing

- Write tests for new features and bug fixes
- Run existing tests before submitting a pull request:
  ```bash
  pytest tests/
  ```
- Aim for >80% test coverage for critical paths

### Security

- **Never commit secrets** (API keys, passwords, tokens) — use environment variables
- Review [SECURITY.md](SECURITY.md) for vulnerability reporting procedures
- All PRs undergo security review before merging

## Submitting Changes

### Pull Requests

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Open a Pull Request** against `main` branch with:
   - Clear title describing the change
   - Description of what was changed and why
   - Reference to any related issues (e.g., "Closes #42")
   - Screenshots or test results if applicable

3. **Address feedback** from code reviewers

4. **Ensure CI passes** (automated tests and security checks)

### Commit Messages

Use conventional commits:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style (formatting, missing semicolons, etc.)
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks
- `security:` — Security-related changes

Example: `feat: add M365 audit logging for DLP policies`

## Reporting Issues

### Bug Reports

Please include:
1. Clear description of the issue
2. Steps to reproduce
3. Expected vs. actual behavior
4. Environment details (OS, browser, Python version)
5. Relevant logs or error messages

### Feature Requests

Please describe:
1. Use case and motivation
2. Proposed solution
3. Alternatives considered
4. Related to compliance or specific customer need?

## Documentation

- Keep [README.md](README.md) up-to-date with new features
- Document environment variables in [.env.example](.env.example)
- Add comments to complex code sections
- Update deployment guides if infrastructure changes are made

## Release Process

1. Version bumping follows [Semantic Versioning](https://semver.org/)
2. Maintain a [CHANGELOG.md](CHANGELOG.md) with user-facing updates
3. Tagged releases are deployed to production by maintainers

## Review Criteria

All PRs are reviewed for:
- ✅ Code quality and standards compliance
- ✅ Security (no hardcoded secrets, input validation)
- ✅ Test coverage
- ✅ Compliance impact (GDPR, NIS2, etc.)
- ✅ Performance implications
- ✅ Documentation completeness

## Questions?

- **General:** Create an issue with the `question` label
- **Security concerns:** Email [security@guecyber.com](mailto:security@guecyber.com)
- **Compliance issues:** Email [compliance@guecyber.com](mailto:compliance@guecyber.com)

---

**Thank you for helping make GueInsight better!** 🙌
