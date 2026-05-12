# Code Conventions

This document outlines the coding conventions, style guides, and best practices followed in this codebase.

## JavaScript/Node.js
- Use ES6+ syntax (let/const, arrow functions, destructuring)
- Prefer single quotes for strings
- Indent with 2 spaces
- Use semicolons
- Use descriptive variable and function names
- Group related functions and constants
- Comment complex logic and public APIs

## React (Frontend)
- Use functional components and hooks
- Use PascalCase for component names
- Use camelCase for props and variables
- Keep components small and focused
- Separate concerns: logic in hooks, UI in components
- Use PropTypes or TypeScript for type safety (if applicable)

## Backend
- Organize code by feature/module
- Use async/await for asynchronous code
- Handle errors with try/catch and error middleware
- Use environment variables for configuration

## Linting & Formatting
- ESLint and Prettier are used for code quality
- Run `npm run lint` before committing

## Git
- Write clear, concise commit messages
- Use feature branches for new work

---

_Last updated: 2026-05-12_