import { Component } from 'react';

/**
 * Minimal ErrorBoundary — catches render errors in children,
 * shows a fallback UI instead of a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      return (
        <div className="appError">
          <span>出错了：{this.state.error?.message || '未知错误'}</span>
          <button onClick={this.handleReset}>
            {this.props.resetLabel || '重试'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
