# Testing Strategy

This document describes the testing approach, tools, and coverage for the codebase.

## Frontend
- Use Jest and React Testing Library for unit and integration tests
- Test components, hooks, and utility functions
- Mock API calls and external dependencies
- Ensure coverage for user interactions and edge cases
- Run tests with `npm test` or `yarn test`

## Backend
- Use Jest or Mocha/Chai for unit and integration tests
- Test API endpoints, database interactions, and business logic
- Use Supertest for HTTP endpoint testing
- Mock database and external services where possible
- Run tests with `npm test`

## General Guidelines
- Write tests for all new features and bug fixes
- Maintain high code coverage (aim for 80%+)
- Use CI to run tests on every push/PR
- Document any manual testing steps if required

---

_Last updated: 2026-05-12_