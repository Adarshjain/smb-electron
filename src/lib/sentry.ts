/**
 * Sentry utility functions for manual error tracking and monitoring
 */
import * as Sentry from '@sentry/react';

/**
 * Capture an exception manually
 * @param error - Error object or string
 * @param context - Additional context for the error
 */
export const captureException = (
  error: Error | string,
  context?: Record<string, unknown>
) => {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
};

/**
 * Capture a message
 * @param message - Message to log
 * @param level - Severity level
 */
export const captureMessage = (
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) => {
  Sentry.captureMessage(message, level);
};

/**
 * Add a breadcrumb (trail of events leading to an error)
 * @param message - Breadcrumb message
 * @param category - Category (e.g., 'ui', 'navigation', 'api')
 * @param data - Additional data
 */
export const addBreadcrumb = (
  message: string,
  category = 'custom',
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
};

/**
 * Set user context for error tracking
 * @param userId - User ID
 * @param userData - Additional user data
 */
export const setUser = (
  userId: string,
  userData?: { email?: string; username?: string; [key: string]: unknown }
) => {
  Sentry.setUser({
    id: userId,
    ...userData,
  });
};

/**
 * Clear user context (e.g., on logout)
 */
export const clearUser = () => {
  Sentry.setUser(null);
};

/**
 * Set custom tags for filtering in Sentry
 * @param tags - Key-value pairs of tags
 */
export const setTags = (tags: Record<string, string>) => {
  Sentry.setTags(tags);
};

/**
 * Set custom context data
 * @param name - Context name
 * @param data - Context data
 */
export const setContext = (name: string, data: Record<string, unknown>) => {
  Sentry.setContext(name, data);
};

/**
 * Wrap a function with error boundary
 * This will automatically capture any errors thrown by the function
 */
export const withErrorBoundary = Sentry.withErrorBoundary;

/**
 * Higher-order component for React error boundaries
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

// Re-export commonly used Sentry functions
export { Sentry };
