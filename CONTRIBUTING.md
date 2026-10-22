# Contributing to Global Markets Command Center

Thank you for your interest in contributing to **Global Markets Command Center**! We welcome contributions from developers of all skill levels—whether you are fixing a bug, improving documentation, adding new market data features, or proposing architectural improvements.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Local Setup](#local-setup)
   - [Environment Variables](#environment-variables)
3. [Development Workflow](#development-workflow)
   - [Available Scripts](#available-scripts)
   - [Testing & Quality Checks](#testing--quality-checks)
4. [Reporting Bugs](#reporting-bugs)
5. [Suggesting Features](#suggesting-features)
6. [Submitting Pull Requests](#submitting-pull-requests)
   - [PR Checklist](#pr-checklist)
   - [Commit Guidelines](#commit-guidelines)
7. [Security & Secrets](#security--secrets)
8. [License](#license)

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please treat others with respect, empathy, and professional courtesy in all communications, issue threads, and pull requests.

---

## Getting Started

### Prerequisites

- **Node.js**: `v22.14.0` or higher
- **npm**: `v10` or higher
- **Git**

### Local Setup

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/AI-TRADING.git
   cd AI-TRADING
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```

### Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the API keys for the providers you want to test locally (e.g., Upstox, Finnhub, Gemini, CoinGecko, OneSignal). Unconfigured providers gracefully fail closed or operate with public fallback data where supported. **Never commit your `.env` file or any secrets to source control.**

---

## Development Workflow

### Available Scripts

- **`npm run dev`**: Starts the local development server with Vite hot reloading and backend middleware on `http://localhost:3000`.
- **`npm run typecheck`**: Runs TypeScript type checking (`tsc --noEmit`).
- **`npm run lint`**: Runs ESLint and TypeScript checks across the repository.
- **`npm test`**: Runs the backend and contract test suite using Node's native test runner (`node:test`).
- **`npm run test:browser`**: Runs Playwright end-to-end browser tests (requires server running).
- **`npm run build`**: Compiles the client bundle (`dist/client`) and bundles the server (`dist/server.js`).
- **`npm start`**: Runs the compiled production server.

### Testing & Quality Checks

Before submitting any changes, ensure all quality checks pass cleanly:
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Reporting Bugs

If you find a bug or unexpected behavior, please report it by opening an issue on GitHub. Before submitting, please search existing issues to see if it has already been reported.

When opening an issue, please include:
- **A clear, descriptive title**.
- **Steps to reproduce**: Step-by-step instructions so others can replicate the issue.
- **Expected behavior**: What you expected to happen.
- **Actual behavior**: What actually happened (including screenshots, logs, or error stack traces).
- **Environment details**: Your OS, Node.js version, browser (if applicable), and screen resolution.

---

## Suggesting Features

We welcome new ideas and feature proposals! To suggest a feature:
1. Open a GitHub Issue using the **Feature Request** template or start a discussion.
2. Clearly explain **the problem or opportunity** this feature addresses.
3. Describe **the proposed solution** or workflow from a user perspective.
4. Mention any relevant external APIs, documentation, or design considerations.

---

## Submitting Pull Requests

Follow these steps to submit your contributions:

1. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Make your changes**: Keep commits focused and cohesive.
3. **Write tests**: If you add new functionality or fix a bug, include unit or integration tests in `server/**/*.test.ts` or `tests/browser/`.
4. **Run verification**: Verify that `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass without errors or warnings.
5. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```
6. **Open a Pull Request**: Submit your PR against the `main` branch with a clear title and description of your changes.

### PR Checklist

- [ ] Code follows existing architectural patterns and conventions.
- [ ] TypeScript types are complete and strict; no `any` hacks.
- [ ] No secrets, API keys, or `.env` files are committed.
- [ ] `npm run lint` and `npm run typecheck` pass with 0 errors.
- [ ] `npm test` passes without failing assertions.
- [ ] Existing documentation (or README) is updated if APIs or settings changed.

### Commit Guidelines

We use conventional commit prefixes:
- `feat:` New features or user-facing enhancements
- `fix:` Bug fixes
- `refactor:` Code refactoring without behavioral changes
- `style:` Formatting or UI styling tweaks
- `docs:` Documentation additions or updates
- `test:` Adding or updating tests
- `chore:` Dependency updates, tooling, or build configuration

---

## Security & Secrets

- **Never hardcode secrets**: All private keys, session tokens, and webhook secrets belong strictly in environment variables read only on the server.
- **Client safety**: Never prefix backend credentials with `VITE_` or expose private endpoints in client builds.
- **Reporting security vulnerabilities**: If you discover a security vulnerability, please do not disclose it publicly in an issue. Instead, report it privately to the maintainers at `khatriom12062007@gmail.com`.

---

## License

By contributing to Global Markets Command Center, you agree that your contributions will be licensed under the [MIT License](LICENSE).
