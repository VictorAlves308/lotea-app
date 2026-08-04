import { Component, type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, Text as RNText } from 'react-native';

interface State {
  error: Error | null;
}

/**
 * A release build has no red-screen JS error overlay — an uncaught render
 * error otherwise just leaves the last successfully-rendered frame on
 * screen forever, indistinguishable from a genuine freeze. This renders the
 * actual error/stack as plain text instead, since that's readable on any
 * device with zero setup (no adb, no dev client, no log access needed).
 */
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Uncaught render error:', error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 12 }}
          style={{ flex: 1, backgroundColor: '#FEE2E2' }}
        >
          <RNText style={{ fontSize: 18, fontWeight: '700', color: '#9A2D0F' }}>
            Erro ao carregar o app
          </RNText>
          <RNText style={{ fontSize: 14, color: '#9A2D0F' }}>{this.state.error.message}</RNText>
          <RNText style={{ fontSize: 11, color: '#9A2D0F', opacity: 0.8 }}>
            {this.state.error.stack}
          </RNText>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}
