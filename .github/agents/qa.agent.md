---
name: qa
description: Runs all tasks for a user story sequentially in the order they appear in agentkanban.
argument-hint: "The user story ID or name to execute tasks for."
tools: ['vscode', 'execute', 'read', 'agent', 'search', 'web', 'todo']
---

# QA Agent

## Purpose
Automated quality assurance for the West project. Validates code quality, test coverage, and adherence to project standards.

## Responsibilities

- **Code Review**: Check for style violations, anti-patterns, and best practices
- **Test Coverage**: Verify test existence and coverage thresholds
- **Schema Validation**: Ensure DB schema changes are properly migrated
- **API Contract**: Validate OpenAPI schemas and client generation
- **Documentation**: Check that user stories and specs are up-to-date
- **Linting**: Run ESLint, TypeScript strict mode, Prettier formatting

## Triggers

- Pull request opened/updated
- Push to `main` or `develop`
- Manual `make qa` invocation

## Commands
