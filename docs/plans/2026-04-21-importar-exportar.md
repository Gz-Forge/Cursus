# Importar / Exportar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar los botones de importar/exportar de ConfigScreen con una pantalla dedicada con tabs Importar | Exportar, soporte para JSON y QRs, y control granular sobre qué datos se exportan.

**Architecture:** Nueva `ImportarExportarScreen` en el Stack navigator. Panel Importar detecta automáticamente el formato del JSON importado. Panel Exportar tiene 2 pasos: elegir qué datos y elegir método (JSON / QRs en pantalla / QRs descargables). Para descarga de QRs se usa la librería `qrcode` que genera data URLs sin necesidad de renderizar vistas.

**Tech Stack:** Expo 54, React Native Web, TypeScript, `qrcode` (generación QR programática), `jszip` (ZIP en web/Tauri), `expo-print` (PDF en móvil).

---

## Pre-requisitos

- Proyecto en `C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp`
- Todos los comandos se corren desde ese directorio

---

### Task 1: Instalar dependencias

**Files:**
- Modify: `TablaApp/package.json`

**Step 1: Instalar paquetes**

```bash
cd "C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp"
npm install qrcode jszip expo-print
npm install --save-dev @types/qrcode @types/jszip
```

**Step 2: Verificar que quedaron en package.json**

Confirmar que `dependencies` tiene: `qrcode`, `jszip`, `expo-print`

---

### Task 2: Crear utilidad exportPayload.ts

**Files:**
- Create: `TablaApp/src/utils/exportPayload.ts`

Esta utilidad construye el objeto JSON que se exporta, cargando los datos de cada perfil seleccionado.

**Step 1: Crear el archivo**

```ts
import { cargarPerfilEstado } from './perfiles';
import { materiasAJson } from './importExport';
import { Perfil } from '../types';

export interface ExportPerfilPayload {
  id: string;
  nombre: string;
  materias: ReturnType<typeof materiasAJson>;
  notas?: Record<string, number | null>;
  evaluaciones?: Record<string, import('../types').Evaluacion[]>;
  horarios?: import('../types').BloqueHorario[];
}

export interface ExportPayload {
  version: 1;
  exportadoEn: string;
  perfiles: ExportPerfilPayload[];
}

export interface OpcionesExport {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  perfilesSelec: Perfil[];
}

export async function construirPayload(opts: OpcionesExport): Promise<ExportPayload> {
  const perfiles: ExportPerfilPayload[] = [];

  for (const perfil of opts.perfilesSelec) {
    const estado = await cargarPerfilEstado(perfil.id);
    const materiasJson = materiasAJson(estado.materias);

    const entry: ExportPerfilPayload = {
      id: perfil.id,
      nombre: perfil.nombre,
      materias: materiasJson,
    };

    if (opts.inclNotas) {
      const notas: Record<string, number | null> = {};
      estado.materias.forEach(m => {
        if (m.usarNotaManual) notas[m.id] = m.notaManual;
      });
      entry.notas = notas;
    }

    if (opts.inclEvaluaciones) {
      const evals: Record<string, import('../types').Evaluacion[]> = {};
      estado.materias.forEach(m => {
        if (m.evaluaciones.length > 0) evals[m.id] = m.evaluaciones;
      });
      entry.evaluaciones = evals;
    }

    if (opts.inclHorarios) {
      const bloques = estado.materias.flatMap(m => m.bloques ?? []);
      entry.horarios = bloques;
    }

    perfiles.push(entry);
  }

  return {
    version: 1,
    exportadoEn: new Date().toISOString(),
    perfiles,
  };
}
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

---

### Task 3: Crear utilidad qrDescarga.ts

**Files:**
- Create: `TablaApp/src/utils/qrDescarga.ts`

Genera QR codes como data URLs PNG y los empaqueta en PDF o ZIP.

**Step 1: Crear el archivo**

```ts
import QRCode from 'qrcode';
import { Platform } from 'react-native';
import { fileIO } from './fileIO';

/** Genera un array de data URLs PNG, uno por chunk QR */
export async function generarQrDataUrls(chunks: { i: number; t: number; d: string }[]): Promise<string[]> {
  const urls: string[] = [];
  for (const chunk of chunks) {
    const url = await QRCode.toDataURL(JSON.stringify(chunk), {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    urls.push(url);
  }
  return urls;
}

/** Descarga cada QR como un PNG separado */
export async function descargarQrsPng(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    dataUrls.forEach((url, i) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nombreBase}-qr-${i + 1}de${dataUrls.length}.png`;
      a.click();
    });
  } else {
    // En móvil: guardar en documentos y compartir
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    for (let i = 0; i < dataUrls.length; i++) {
      const base64 = dataUrls[i].replace(/^data:image\/png;base64,/, '');
      const ruta = `${FileSystem.documentDirectory}${nombreBase}-qr-${i + 1}.png`;
      await FileSystem.writeAsStringAsync(ruta, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(ruta, { mimeType: 'image/png' });
    }
  }
}

/** Descarga todos los QRs en un ZIP (web/Tauri) o comparte individualmente (móvil) */
export async function descargarQrsZip(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  if (Platform.OS !== 'web') {
    // En móvil delegamos al mismo flujo PNG
    await descargarQrsPng(dataUrls, nombreBase);
    return;
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  dataUrls.forEach((url, i) => {
    const base64 = url.replace(/^data:image\/png;base64,/, '');
    zip.file(`${nombreBase}-qr-${i + 1}de${dataUrls.length}.png`, base64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreBase}-qrs.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga todos los QRs en un PDF */
export async function descargarQrsPdf(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  const html = `
    <html><body style="margin:0;padding:0;background:#fff;">
      ${dataUrls.map((url, i) => `
        <div style="page-break-after:always;display:flex;flex-direction:column;
          align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <p style="margin-bottom:16px;font-size:18px;color:#333;">
            QR ${i + 1} de ${dataUrls.length}
          </p>
          <img src="${url}" style="width:300px;height:300px;" />
        </div>
      `).join('')}
    </body></html>
  `;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  } else {
    const Print = await import('expo-print');
    await Print.printAsync({ html, base64: false });
  }
}
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

---

### Task 4: Crear ImportarExportarScreen — esqueleto con tabs

**Files:**
- Create: `TablaApp/src/screens/ImportarExportarScreen.tsx`

**Step 1: Crear el archivo con la estructura base**

```tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';

type Tab = 'importar' | 'exportar';

export function ImportarExportarScreen() {
  const tema = useTema();
  const [tab, setTab] = useState<Tab>('importar');

  const tabStyle = (t: Tab) => ({
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center' as const,
    borderBottomWidth: 2,
    borderBottomColor: tab === t ? tema.acento : 'transparent',
  });

  const tabTextStyle = (t: Tab) => ({
    color: tab === t ? tema.acento : tema.textoSecundario,
    fontWeight: tab === t ? '700' as const : '400' as const,
    fontSize: 15,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: tema.borde,
        backgroundColor: tema.fondo,
      }}>
        <TouchableOpacity style={tabStyle('importar')} onPress={() => setTab('importar')}>
          <Text style={tabTextStyle('importar')}>📥 Importar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('exportar')} onPress={() => setTab('exportar')}>
          <Text style={tabTextStyle('exportar')}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>
          {tab === 'importar' ? <PanelImportar /> : <PanelExportar />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PanelImportar() {
  const tema = useTema();
  return (
    <View>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
        Próximamente
      </Text>
    </View>
  );
}

function PanelExportar() {
  const tema = useTema();
  return (
    <View>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
        Próximamente
      </Text>
    </View>
  );
}
```

---

### Task 5: Actualizar RootNavigator — agregar stack screen

**Files:**
- Modify: `TablaApp/src/navigation/RootNavigator.tsx`

**Step 1: Agregar import**

En los imports del archivo, agregar:
```ts
import { ImportarExportarScreen } from '../screens/ImportarExportarScreen';
```

**Step 2: Agregar Stack.Screen**

Dentro del `Stack.Navigator`, después de `TarjetaConfig`, agregar:
```tsx
<Stack.Screen
  name="ImportarExportar"
  component={ImportarExportarScreen}
  options={{ headerShown: true, title: 'Importar / Exportar' }}
/>
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

---

### Task 6: Actualizar ConfigScreen — sección y botón

**Files:**
- Modify: `TablaApp/src/screens/ConfigScreen.tsx`

**Step 1: Eliminar imports que ya no se usan**

Eliminar del bloque de imports:
```ts
import { exportarCarrera, importarCarrera } from '../utils/importExportNative';
import { jsonAMaterias, extraerTiposNuevos, normalizarTipo, generarPromptCarrera, generarPromptEvaluaciones } from '../utils/importExport';
```
Y agregar de vuelta solo lo que sigue siendo necesario:
```ts
import { normalizarTipo, generarPromptCarrera, generarPromptEvaluaciones } from '../utils/importExport';
```

**Step 2: Eliminar la función handleImportar**

Eliminar toda la función `handleImportar` (líneas 91-119 del archivo original).

**Step 3: Reemplazar la sección DATOS DE LA CARRERA**

Buscar:
```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>DATOS DE LA CARRERA</Text>

<TouchableOpacity
  onPress={() => exportarCarrera(materias)}
  style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 }}
>
  <Text style={{ color: tema.texto, fontWeight: '600' }}>📤 Exportar carrera (.json)</Text>
</TouchableOpacity>

<TouchableOpacity
  onPress={handleImportar}
  style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 }}
>
  <Text style={{ color: tema.texto, fontWeight: '600' }}>📥 Importar carrera (.json)</Text>
</TouchableOpacity>

<Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginBottom: 20 }}>
  El .json solo contiene estructura de materias, no tus notas ni evaluaciones.
</Text>
```

Reemplazar con:
```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>IMPORTAR / EXPORTAR</Text>

<TouchableOpacity
  onPress={() => navigation.navigate('ImportarExportar' as never)}
  style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: tema.borde }}
>
  <Text style={{ color: tema.texto, fontWeight: '600' }}>📦 Gestionar importación y exportación →</Text>
</TouchableOpacity>
```

**Step 4: Limpiar estado que ya no se usa**

Eliminar del estado local del componente:
- `const [mostrarScanner, setMostrarScanner] = useState(false);` — si ya no se usa en ConfigScreen (verificar)
- El `<QrScannerModal>` si está solo para importar (verificar si sigue siendo necesario para otra función)

Nota: `QrScannerModal` en ConfigScreen se usa para "Escanear QR de la web" (QR login), que es DIFERENTE al scanner de importación. Ese botón debe QUEDAR tal cual.

**Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

---

### Task 7: Implementar PanelImportar

**Files:**
- Modify: `TablaApp/src/screens/ImportarExportarScreen.tsx`

Reemplazar el componente `PanelImportar` con la implementación completa:

```tsx
function PanelImportar() {
  const tema = useTema();
  const { guardarMateria, config, actualizarConfig } = useStore();
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleImportarJson = async () => {
    setCargando(true);
    let contenido: string | null = null;
    try {
      contenido = await fileIO.importarArchivo();
    } catch {
      Alert.alert('Error', 'No se pudo abrir el archivo.');
      setCargando(false);
      return;
    }
    setCargando(false);
    if (!contenido) return;

    let datos: unknown;
    try {
      datos = JSON.parse(contenido);
    } catch {
      Alert.alert('Error', 'El archivo no es un JSON válido.');
      return;
    }

    // Detectar formato
    if (Array.isArray(datos) && datos[0]?.nombre && datos[0]?.semestre !== undefined) {
      // Formato carrera
      const { jsonAMaterias, extraerTiposNuevos } = await import('../utils/importExport');
      const materias = jsonAMaterias(datos as any, config.oportunidadesExamenDefault);
      const tiposNuevos = extraerTiposNuevos(datos as any, config.tiposFormacion);
      Alert.alert(
        'Importar carrera',
        `Se encontraron ${materias.length} materias. ¿Reemplazar datos actuales?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Importar',
            onPress: () => {
              if (tiposNuevos.length > 0) {
                actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
              }
              materias.forEach(m => guardarMateria(m));
            },
          },
        ]
      );
      return;
    }

    if (
      typeof datos === 'object' &&
      datos !== null &&
      'version' in datos &&
      (datos as any).version === 1 &&
      Array.isArray((datos as any).perfiles)
    ) {
      // Formato propio de exportación completa
      Alert.alert(
        'Importar datos completos',
        `El archivo contiene ${(datos as any).perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
      );
      return;
    }

    Alert.alert(
      'Formato no reconocido',
      'El archivo no tiene un formato conocido.\n\nFormatos aceptados:\n• Carrera: generado con el prompt de IA (Configuración → Prompts IA)\n• Exportación completa: generada desde esta pantalla',
    );
  };

  return (
    <View>
      {/* Sección JSON */}
      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        DESDE ARCHIVO .JSON
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12, lineHeight: 20 }}>
          Formatos aceptados:{'\n'}
          • <Text style={{ color: tema.texto }}>Carrera</Text>: generado con el prompt de IA{'\n'}
          • <Text style={{ color: tema.texto }}>Exportación completa</Text>: generada desde esta pantalla{'\n\n'}
          💡 Encontrás los prompts en{' '}
          <Text style={{ color: tema.acento }}>Configuración → Prompts para IA</Text>
        </Text>
        <TouchableOpacity
          onPress={handleImportarJson}
          disabled={cargando}
          style={{
            backgroundColor: tema.acento,
            padding: 14, borderRadius: 10,
            alignItems: 'center',
          }}
        >
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700' }}>📂 Seleccionar archivo .json</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Sección QR — solo móvil */}
      {Platform.OS !== 'web' && (
        <>
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
            ESCANEANDO QR
          </Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
              Escaneá los QRs generados por otro dispositivo para importar la información.
            </Text>
            <TouchableOpacity
              onPress={() => setMostrarScanner(true)}
              style={{
                backgroundColor: tema.tarjeta,
                padding: 14, borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: tema.acento,
              }}
            >
              <Text style={{ color: tema.acento, fontWeight: '700' }}>📷 Abrir escáner</Text>
            </TouchableOpacity>
          </View>
          <QrScannerModal visible={mostrarScanner} onCerrar={() => setMostrarScanner(false)} />
        </>
      )}
    </View>
  );
}
```

Agregar imports necesarios al tope de la pantalla:
```tsx
import { fileIO } from '../utils/fileIO';
import { QrScannerModal } from '../components/QrScannerModal';
```

---

### Task 8: Implementar PanelExportar — paso 1 (checkboxes)

**Files:**
- Modify: `TablaApp/src/screens/ImportarExportarScreen.tsx`

Reemplazar el componente `PanelExportar` stub con:

```tsx
function PanelExportar() {
  const tema = useTema();
  const { materias, perfiles, perfilActivoId } = useStore();
  const [inclNotas, setInclNotas] = useState(false);
  const [inclEvaluaciones, setInclEvaluaciones] = useState(false);
  const [inclHorarios, setInclHorarios] = useState(false);
  const [perfilesSelec, setPerfilesSelec] = useState<string[]>([perfilActivoId]);
  const [mostrarMetodos, setMostrarMetodos] = useState(false);

  const togglePerfil = (id: string) => {
    setPerfilesSelec(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const Checkbox = ({
    label, value, onChange, disabled,
  }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <TouchableOpacity
      onPress={() => !disabled && onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: disabled ? tema.borde : tema.acento,
        backgroundColor: value ? (disabled ? tema.borde : tema.acento) : 'transparent',
        marginRight: 10, alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ color: disabled ? tema.textoSecundario : tema.texto, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 1 — ¿QUÉ EXPORTAR?
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Checkbox label="Materias (obligatorio)" value disabled onChange={() => {}} />
        <Checkbox label="Notas" value={inclNotas} onChange={setInclNotas} />
        <Checkbox label="Evaluaciones" value={inclEvaluaciones} onChange={setInclEvaluaciones} />
        <Checkbox label="Horarios" value={inclHorarios} onChange={setInclHorarios} />
      </View>

      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PERFILES A INCLUIR
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
        {perfiles.map(p => (
          <TouchableOpacity
            key={p.id}
            onPress={() => togglePerfil(p.id)}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: perfilesSelec.includes(p.id) ? tema.acento : tema.borde,
              backgroundColor: perfilesSelec.includes(p.id) ? tema.acento : 'transparent',
              marginRight: 10, alignItems: 'center', justifyContent: 'center',
            }}>
              {perfilesSelec.includes(p.id) && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ color: tema.texto, fontSize: 14 }}>
              {p.nombre}{p.id === perfilActivoId ? ' (activo)' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 2 — ¿CÓMO EXPORTAR?
      </Text>
      <PanelMetodos
        inclNotas={inclNotas}
        inclEvaluaciones={inclEvaluaciones}
        inclHorarios={inclHorarios}
        perfilesSelec={perfiles.filter(p => perfilesSelec.includes(p.id))}
        materiasActivas={materias}
      />
    </View>
  );
}
```

Agregar imports al tope:
```tsx
import { construirPayload } from '../utils/exportPayload';
import { encodeCarrera, splitEnChunks } from '../utils/qrPayload';
import { materiasAJson } from '../utils/importExport';
import { QrShareModal } from '../components/QrShareModal';
import { generarQrDataUrls, descargarQrsPng, descargarQrsPdf, descargarQrsZip } from '../utils/qrDescarga';
import { fileIO } from '../utils/fileIO';
import { Materia, Perfil } from '../types';
```

---

### Task 9: Implementar PanelMetodos — JSON y QRs en pantalla

**Files:**
- Modify: `TablaApp/src/screens/ImportarExportarScreen.tsx`

Agregar el componente `PanelMetodos` al final del archivo (antes del cierre):

```tsx
interface PanelMetodosProps {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  perfilesSelec: Perfil[];
  materiasActivas: Materia[];
}

function PanelMetodos({
  inclNotas, inclEvaluaciones, inclHorarios, perfilesSelec, materiasActivas,
}: PanelMetodosProps) {
  const tema = useTema();
  const [cargando, setCargando] = useState(false);
  const [mostrarQrModal, setMostrarQrModal] = useState(false);
  const [mostrarOpcionesQr, setMostrarOpcionesQr] = useState(false);

  const sinPerfiles = perfilesSelec.length === 0;

  const handleDescargarJson = async () => {
    if (sinPerfiles) {
      Alert.alert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, perfilesSelec,
      });
      const contenido = JSON.stringify(payload, null, 2);
      await fileIO.exportarArchivo('cursus-exportacion.json', contenido);
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el archivo.');
    } finally {
      setCargando(false);
    }
  };

  const handleQrPantalla = () => {
    if (sinPerfiles) {
      Alert.alert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setMostrarQrModal(true);
  };

  const handleDescargarQrs = async (formato: 'png' | 'pdf' | 'zip') => {
    if (sinPerfiles) {
      Alert.alert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, perfilesSelec,
      });
      // Usamos solo las materias del primer perfil para QR (limitación de tamaño)
      const materias = payload.perfiles[0]?.materias ?? [];
      const encoded = encodeCarrera(materias);
      const chunks = splitEnChunks(encoded);
      const dataUrls = await generarQrDataUrls(chunks);

      if (formato === 'png') await descargarQrsPng(dataUrls, 'cursus');
      else if (formato === 'pdf') await descargarQrsPdf(dataUrls, 'cursus');
      else await descargarQrsZip(dataUrls, 'cursus');

      setMostrarOpcionesQr(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar los QRs.');
    } finally {
      setCargando(false);
    }
  };

  // Solo materias del perfil activo para el QrShareModal (que ya existe)
  const materiasParaQr = materiasActivas;

  return (
    <>
      {cargando && (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ActivityIndicator color={tema.acento} />
          <Text style={{ color: tema.textoSecundario, marginTop: 8 }}>Generando...</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleDescargarJson}
        disabled={cargando || sinPerfiles}
        style={{
          backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
          padding: 14, borderRadius: 10, alignItems: 'center',
          marginBottom: 10, borderWidth: 1, borderColor: tema.borde,
        }}
      >
        <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
          📄 Descargar .json
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleQrPantalla}
        disabled={cargando || sinPerfiles}
        style={{
          backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
          padding: 14, borderRadius: 10, alignItems: 'center',
          marginBottom: 10, borderWidth: 1, borderColor: tema.borde,
        }}
      >
        <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
          📱 Ver QRs en pantalla (1 x 1)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMostrarOpcionesQr(v => !v)}
        disabled={cargando || sinPerfiles}
        style={{
          backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
          padding: 14, borderRadius: 10, alignItems: 'center',
          marginBottom: 4, borderWidth: 1, borderColor: tema.borde,
        }}
      >
        <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
          🖼️ Descargar QRs {mostrarOpcionesQr ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {mostrarOpcionesQr && (
        <View style={{
          backgroundColor: tema.fondo, borderRadius: 10, borderWidth: 1,
          borderColor: tema.borde, overflow: 'hidden', marginBottom: 10,
        }}>
          {(['png', 'pdf', 'zip'] as const).map(fmt => (
            <TouchableOpacity
              key={fmt}
              onPress={() => handleDescargarQrs(fmt)}
              style={{
                padding: 13, borderBottomWidth: fmt !== 'zip' ? 1 : 0,
                borderBottomColor: tema.borde, alignItems: 'center',
              }}
            >
              <Text style={{ color: tema.texto }}>
                {fmt === 'png' ? '🖼️ PNG por QR' : fmt === 'pdf' ? '📋 PDF con todos' : '🗜️ ZIP con todos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {sinPerfiles && (
        <Text style={{ color: '#FF9800', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          ⚠️ Seleccioná al menos un perfil arriba
        </Text>
      )}

      <QrShareModal
        visible={mostrarQrModal}
        materias={materiasParaQr}
        onCerrar={() => setMostrarQrModal(false)}
      />
    </>
  );
}
```

---

### Task 10: Verificación final y commit

**Step 1: TypeScript limpio**

```bash
cd "C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp"
npx tsc --noEmit
```

Expected: 0 errores nuevos.

**Step 2: Build web limpio**

```bash
npx expo export --platform web
```

Expected: genera `dist/` sin errores.

**Step 3: Verificar manualmente en el navegador**

```bash
npx expo start --web
```

Ir a Configuración → verificar que aparece el botón "📦 Gestionar importación y exportación →" y navega a la nueva pantalla con los dos tabs.

**Step 4: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx \
        src/screens/ConfigScreen.tsx \
        src/navigation/RootNavigator.tsx \
        src/utils/exportPayload.ts \
        src/utils/qrDescarga.ts \
        package.json package-lock.json

git commit -m "feat: add ImportarExportar screen with JSON and QR export/import"
```

---

## Resumen de archivos

| Acción | Archivo |
|---|---|
| Crear | `src/screens/ImportarExportarScreen.tsx` |
| Crear | `src/utils/exportPayload.ts` |
| Crear | `src/utils/qrDescarga.ts` |
| Modificar | `src/screens/ConfigScreen.tsx` |
| Modificar | `src/navigation/RootNavigator.tsx` |
| Modificar | `package.json` |
