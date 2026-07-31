import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
    children: ReactNode;
};

type ErrorBoundaryState = {
    error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Elements Lab crashed', error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="crash">
                <h1>Elements Lab hit an unexpected error</h1>
                <pre>{error.message}</pre>
                <button
                    type="button"
                    className="chip chip--primary"
                    onClick={function reload() {
                        window.location.reload();
                    }}
                >
                    Reload
                </button>
            </div>
        );
    }
}
