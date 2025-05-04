# Calendar App Logging System

## Overview

The Calendar App uses a robust, centralized logging system that provides:

- Consistent log formatting across the application
- Environment-specific logging configurations
- Structured logging for easier parsing in production
- Contextual logging with domain-specific information
- Error tracking integration
- Performance measurement tools

## Architecture

The logging system consists of several key components:

1. **Core Logger** (`src/utils/logger.ts`): The main logging class that provides basic logging functionality.
2. **Environment Configuration** (`src/config/environment.ts`): Controls logging behavior based on environment.
3. **Logger Initialization** (`src/utils/initializeLogger.ts`): Configures the logger at application startup.
4. **Error Handling Integration** (`src/utils/errorHandler.ts`): Connects errors to the logging system.
5. **Specialized Loggers**: Domain-specific loggers with additional context (e.g., `src/presentation/services/storageLogger.ts`).
6. **Error Boundary** (`src/presentation/components/ErrorBoundary.tsx`): React component that catches and logs UI errors.

## Log Levels

The system uses the following log levels (in order of severity):

1. `ERROR`: Critical issues that require immediate attention
2. `WARN`: Potential issues or unexpected behaviors
3. `INFO`: General operational information
4. `DEBUG`: Detailed information useful for debugging
5. `TRACE`: Very verbose diagnostic information

## Usage

### Basic Logging

Import the default logger:

```typescript
import { logger } from './utils/logger';

logger.info('User logged in', { userId: '123' });
logger.error('Failed to process request', error);
```

### Domain-Specific Logging

Create a domain-specific logger with additional context:

```typescript
import { getLogger } from './utils/logger';

const paymentLogger = getLogger('payments');
paymentLogger.setContext({ domain: 'payments', processor: 'stripe' });

paymentLogger.info('Payment processed', { amount: 100, currency: 'USD' });
```

### Specialized Logging Functions

Use specialized logging utilities for specific areas:

```typescript
import { 
  logStorageOperation, 
  logStorageQuery, 
  STORAGE_OPERATIONS 
} from './presentation/services/storageLogger';

logStorageOperation(
  STORAGE_OPERATIONS.WRITE, 
  'Saving user calendar events', 
  { count: events.length }
);
```

### Performance Tracking

Track operation performance:

```typescript
import { trackStorageOperation } from './presentation/services/storageLogger';

const results = await trackStorageOperation(
  'fetchUserEvents', 
  () => fetchEventsFromDatabase(userId)
);
```

### Error Handling

Use the error handling utilities to ensure proper logging:

```typescript
import { handleError, DatabaseError } from './utils/errorHandler';

try {
  await saveData();
} catch (error) {
  const dbError = new DatabaseError(
    'Failed to save calendar events',
    'DB_WRITE_ERROR',
    500,
    error,
    { userId, eventCount: events.length }
  );
  handleError(dbError);
  throw dbError;
}
```

## Environment-Specific Configuration

Logging behavior varies by environment:

### Development

- Level: `DEBUG`
- Format: Human-readable text with colors
- Timestamps: Local time format

### Test

- Level: `NONE` (logs disabled by default)
- Can be enabled for specific tests

### Production

- Level: `INFO`
- Format: Structured JSON for machine parsing
- Timestamps: ISO format

## Extending the System

To add a new domain-specific logger:

1. Create a new file for your domain logger
2. Import the base logger utilities
3. Create helper functions specific to your domain
4. Document usage examples

Example:

```typescript
// src/features/analytics/analyticsLogger.ts
import { getLogger } from '../../utils/logger';

const analyticsLogger = getLogger('analytics');
analyticsLogger.setContext({ domain: 'analytics' });

export function logUserAction(action: string, details: Record<string, any>) {
  analyticsLogger.info(`User action: ${action}`, details);
}

export default analyticsLogger;
```

## Best Practices

1. Use the appropriate log level for your message
2. Add contextual information to logs when possible
3. Structure log messages for readability and parseability
4. Include relevant IDs for correlation (user ID, request ID, etc.)
5. Use domain-specific loggers when appropriate
6. Avoid logging sensitive information
7. Use Error objects for error logging, not just strings 