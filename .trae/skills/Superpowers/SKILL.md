---
name: "Superpowers"
description: "Enhances code with advanced patterns, performance optimizations, and best practices. Invoke when code needs performance improvements, modern patterns, or production-ready enhancements."
---

# Superpowers

This skill enhances code with advanced techniques, optimizations, and best practices to make it production-ready.

## When to Invoke

- Code needs performance optimization
- Memory usage needs improvement
- Error handling is insufficient
- Logging/debugging capabilities are missing
- Security vulnerabilities exist
- Scalability concerns need addressing
- Modern language features should be applied

## Enhancement Areas

### 1. Performance Optimization
- Algorithm optimization (time/space complexity)
- Caching strategies (memoization, LRU)
- Lazy loading and code splitting
- Database query optimization
- Batch processing
- Async/await patterns

### 2. Memory Management
- Prevent memory leaks
- Optimize data structures
- Use weak references where appropriate
- Stream processing for large datasets

### 3. Error Handling & Resilience
- Comprehensive error handling
- Retry mechanisms with exponential backoff
- Circuit breaker pattern
- Graceful degradation
- Transaction management

### 4. Observability
- Structured logging
- Metrics collection
- Distributed tracing
- Health checks
- Performance monitoring

### 5. Security Hardening
- Input validation and sanitization
- Rate limiting
- Authentication/authorization
- Data encryption
- Secure defaults

### 6. Concurrency & Parallelism
- Worker threads/processes
- Connection pooling
- Queue-based processing
- Lock-free algorithms

### 7. Modern Patterns
- Functional programming patterns
- Reactive programming
- Event-driven architecture
- Dependency injection
- Plugin architecture

## Example Transformations

### Before: Basic Implementation
```javascript
function fetchData(url) {
  return fetch(url).then(res => res.json());
}
```

### After: Production-Ready
```javascript
async function fetchData(url, options = {}) {
  const { retries = 3, timeout = 5000, cache = false } = options;
  
  // Check cache first
  if (cache && cache.has(url)) {
    return cache.get(url);
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (cache) {
        cache.set(url, data);
      }
      
      return data;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
      await delay(Math.pow(2, attempt) * 100); // Exponential backoff
    }
  }
}
```

## Process

1. Analyze current code for improvement opportunities
2. Identify applicable enhancements
3. Apply optimizations incrementally
4. Maintain backward compatibility where possible
5. Add tests for new functionality
6. Document changes and rationale
