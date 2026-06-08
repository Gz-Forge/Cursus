import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Platform, Share, Linking,
} from 'react-native';
import appJson from '../../app.json';

const APP_VERSION: string = appJson.expo.version;

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  stackExpanded: boolean;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, stackExpanded: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[GlobalErrorBoundary]', error, errorInfo);
  }

  private buildLog(): string {
    const { error, errorInfo } = this.state;
    return [
      'Cursus — Error Report',
      `Fecha: ${new Date().toISOString()}`,
      `Versión: ${APP_VERSION}`,
      `Plataforma: ${Platform.OS}`,
      '---',
      `${error?.name ?? 'Error'}: ${error?.message ?? 'desconocido'}`,
      '',
      'Stack:',
      error?.stack ?? '(sin stack)',
      '',
      'Component Stack:',
      errorInfo?.componentStack ?? '(sin component stack)',
    ].join('\n');
  }

  private handleDownload = () => {
    const log = this.buildLog();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursus-error-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  private handleShare = async () => {
    const log = this.buildLog();
    try {
      await Share.share({ message: log, title: 'Cursus — Error Report' });
    } catch {
      // usuario canceló o plataforma no soporta
    }
  };

  private handleEmail = () => {
    const subject = encodeURIComponent(`[Cursus] Error Report v${APP_VERSION}`);
    const body = encodeURIComponent(this.buildLog());
    const url = `mailto:contacto@gz-forge.com?subject=${subject}&body=${body}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, stackExpanded } = this.state;
    const date = new Date().toISOString().slice(0, 10);

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{
            color: '#FF9800', fontSize: 20, fontWeight: '700',
            marginBottom: 20, textAlign: 'center',
          }}>
            ⚠  Cursus encontró un error
          </Text>

          <View style={{
            backgroundColor: '#111', borderRadius: 8,
            padding: 16, marginBottom: 24,
          }}>
            <Text style={{
              color: '#FFFFFF', fontSize: 14,
              fontFamily: 'monospace', marginBottom: 12,
            }}>
              {error?.message ?? 'Error desconocido'}
            </Text>

            <TouchableOpacity
              onPress={() => this.setState(s => ({ stackExpanded: !s.stackExpanded }))}
            >
              <Text style={{ color: '#BB86FC', fontSize: 12 }}>
                {stackExpanded ? 'Ocultar detalle ▲' : 'Ver detalle ▼'}
              </Text>
            </TouchableOpacity>

            {stackExpanded && (
              <ScrollView style={{ maxHeight: 220, marginTop: 10 }} nestedScrollEnabled>
                <Text style={{ color: '#AAAAAA', fontSize: 11, fontFamily: 'monospace' }}>
                  {error?.stack ?? '(sin stack)'}
                </Text>
              </ScrollView>
            )}
          </View>

          {Platform.OS === 'web' && (
            <TouchableOpacity
              onPress={this.handleDownload}
              style={{
                backgroundColor: '#1E1E1E', padding: 14,
                borderRadius: 8, marginBottom: 10, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>⬇  Descargar log</Text>
            </TouchableOpacity>
          )}

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={this.handleShare}
              style={{
                backgroundColor: '#1E1E1E', padding: 14,
                borderRadius: 8, marginBottom: 10, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>↑  Compartir log</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={this.handleEmail}
            style={{
              backgroundColor: '#1E1E1E', padding: 14,
              borderRadius: 8, marginBottom: 28, alignItems: 'center',
              borderWidth: 1, borderColor: '#333',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>✉  Enviar a soporte</Text>
          </TouchableOpacity>

          <Text style={{ color: '#444', fontSize: 11, textAlign: 'center' }}>
            v{APP_VERSION} · {Platform.OS} · {date}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
