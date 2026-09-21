import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Nomad } from '@/constants/theme';

type Props = { children: ReactNode };
type State = { message: string | null; stack: string | null };

export class FieldErrorBoundary extends Component<Props, State> {
  state: State = { message: null, stack: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack?.split('\n').slice(0, 8).join('\n') ?? null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const frames = [
      error.message || 'Unknown error',
      error.stack?.split('\n').slice(0, 8).join('\n'),
      info.componentStack?.split('\n').slice(0, 8).join('\n'),
    ].filter(Boolean);
    this.setState({
      message: error.message || 'Unknown error',
      stack: frames.join('\n'),
    });
  }

  render() {
    if (this.state.message) {
      return (
        <View style={styles.box}>
          <Text style={styles.kicker}>NOMAD</Text>
          <Text style={styles.title}>Could not open</Text>
          <Text style={styles.body}>{this.state.message}</Text>
          {this.state.stack ? <Text style={styles.stack}>{this.state.stack}</Text> : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: Nomad.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  kicker: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 4,
  },
  title: {
    color: Nomad.bone,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: Nomad.mist,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stack: {
    color: Nomad.mist,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'left',
    alignSelf: 'stretch',
    opacity: 0.75,
  },
});
