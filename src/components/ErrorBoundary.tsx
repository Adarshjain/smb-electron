import { Component, type ReactNode } from 'react';
import { toast } from 'sonner';
import { toastStyles } from '@/constants/loanForm';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    toast.error(`Application Error: ${error.message}`, {
      className: toastStyles.error,
      description: errorInfo.componentStack?.slice(0, 200),
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen items-center justify-center p-4">
            <div className="max-w-md rounded-lg border border-destructive bg-card p-6 text-center">
              <h2 className="mb-2 text-2xl font-bold text-destructive">
                Something went wrong
              </h2>
              <p className="mb-4 text-muted-foreground">
                {this.state.error?.message ||
                  'An unexpected error occurred. Please refresh the page.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Reload Application
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

