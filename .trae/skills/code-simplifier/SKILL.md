---
name: "code-simplifier"
description: "Simplifies complex code by removing unnecessary complexity, reducing nesting, and improving readability. Invoke when code is overly complex, has deep nesting, or needs to be made more maintainable."
---

# Code Simplifier

This skill helps simplify complex code to improve readability and maintainability.

## When to Invoke

- Code has deep nesting (3+ levels)
- Functions are too long (>50 lines)
- Logic is convoluted or hard to follow
- There are unnecessary abstractions
- Code duplication exists
- Boolean flags make code confusing

## Simplification Techniques

### 1. Reduce Nesting
- Use early returns (guard clauses)
- Invert conditions to flatten code
- Extract nested logic into functions

### 2. Remove Unnecessary Complexity
- Eliminate unused parameters
- Remove dead code
- Simplify boolean expressions
- Replace complex conditionals with descriptive variables

### 3. Improve Naming
- Use descriptive variable/function names
- Avoid abbreviations
- Make intent clear through naming

### 4. Extract Functions
- Single Responsibility Principle
- Extract complex expressions
- Create helper functions for repeated logic

### 5. Simplify Control Flow
- Replace switch/if-else chains with lookup tables
- Use polymorphism instead of type checks
- Leverage language features (nullish coalescing, optional chaining)

## Example Transformations

### Before: Deep Nesting
```javascript
function processUser(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        return doSomething(user);
      }
    }
  }
  return null;
}
```

### After: Early Returns
```javascript
function processUser(user) {
  if (!user) return null;
  if (!user.isActive) return null;
  if (!user.hasPermission) return null;
  return doSomething(user);
}
```

## Process

1. Analyze the code for complexity issues
2. Identify simplification opportunities
3. Apply appropriate techniques
4. Ensure functionality remains unchanged
5. Verify improved readability
