# Error Boundary Global — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear un Error Boundary global que muestra pantalla negra con el error, opciones de reporte, y bloquea el clic derecho en web.

**Architecture:** Clase React `GlobalErrorBoundary` en `src/components/` que envuelve toda la app en `App.tsx`. Usa `Share.share` de React Native en móvil y download via Blob en web. El log incluye mensaje, stack, versión (leída de `app.json`) y plataforma.

**Tech Stack:** React class component, React Native `Share` + `Linking`, `Platform`, versión desde `app.json`.

---

### Task 1: Crear `GlobalErrorBoundary.tsx`

**Files:**
- Create: `src/components/GlobalErrorBoundary.tsx`

**Step 1: Crear el archivo con el código completo**

```tsx
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
          {/* Título */}
          <Text style={{
            color: '#FF9800', fontSize: 20, fontWeight: '700',
            marginBottom: 20, textAlign: 'center',
          }}>
            ⚠  Cursus encontró un error
          </Text>

          {/* Caja del error */}
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

          {/* Botón: solo web */}
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

          {/* Botón: solo móvil */}
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

          {/* Botón: ambas plataformas */}
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

          {/* Footer */}
          <Text style={{ color: '#444', fontSize: 11, textAlign: 'center' }}>
            v{APP_VERSION} · {Platform.OS} · {date}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
```

**Step 2: Verificar que TypeScript no tiene errores**

```bash
cd /c/Users/nicol/Desktop/App/Tabla_Cursos/TablaApp
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores relacionados a `GlobalErrorBoundary.tsx`.

> Si aparece error `Cannot find module '../../app.json'`, agregar al `tsconfig.json`:
> ```json
> "resolveJsonModule": true
> ```

**Step 3: Commit**

```bash
git add src/components/GlobalErrorBoundary.tsx
git commit -m "feat(error): add GlobalErrorBoundary with black fallback screen, log download and mailto"
```

---

### Task 2: Modificar `App.tsx`

**Files:**
- Modify: `App.tsx`

**Step 1: Aplicar los dos cambios**

Cambio A — importar `GlobalErrorBoundary` y `Platform`:

```tsx
// Agregar imports al inicio del archivo:
import { Platform } from 'react-native';
import { GlobalErrorBoundary } from './src/components/GlobalErrorBoundary';
```

Cambio B — extender el bloqueo de clic derecho de Tauri-only a cualquier web:

```tsx
// ANTES:
useEffect(() => {
  if (!isTauri()) return;
  const bloquear = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', bloquear);
  return () => document.removeEventListener('contextmenu', bloquear);
}, []);

// DESPUÉS:
useEffect(() => {
  if (Platform.OS !== 'web') return;
  const bloquear = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', bloquear);
  return () => document.removeEventListener('contextmenu', bloquear);
}, []);
```

Cambio C — envolver el return con `GlobalErrorBoundary`:

```tsx
// ANTES:
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <RootNavigator />
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

// DESPUÉS:
return (
  <GlobalErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AlertProvider>
            <RootNavigator />
          </AlertProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </GlobalErrorBoundary>
);
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

**Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(error): wrap app in GlobalErrorBoundary, extend contextmenu block to all web"
```

---

### Task 3: Verificar en web

**Step 1: Levantar expo web**

```bash
npx expo start --web
```

**Step 2: Forzar un error de prueba (temporal)**

En cualquier pantalla, temporalmente agregar al inicio de un componente:

```tsx
throw new Error('Test de error boundary');
```

**Step 3: Verificar**

- Pantalla negra visible ✓
- Mensaje de error visible ✓
- "Ver detalle ▼" expande el stack ✓
- Clic derecho NO muestra menú del navegador ✓
- "Descargar log" descarga el `.txt` ✓
- "Enviar a soporte" abre cliente de email con asunto y cuerpo precargados ✓

**Step 4: Revertir el throw de prueba**

Sacar el `throw` temporal.

**Step 5: Push al PR**

```bash
git push origin feat/felicitaciones-anio-spacebar
```
