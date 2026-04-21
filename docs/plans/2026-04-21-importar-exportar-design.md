# Diseño: Pantalla Importar / Exportar

**Fecha:** 2026-04-21
**Estado:** Aprobado

## Objetivo

Reemplazar los botones de importar/exportar de ConfigScreen por una pantalla dedicada con dos tabs (Importar | Exportar) que soporte JSON y QRs, con control granular sobre qué datos se exportan y en qué formato.

## Cambios en ConfigScreen

- Renombrar sección `DATOS DE LA CARRERA` → `IMPORTAR / EXPORTAR`
- Reemplazar los dos botones actuales por uno: `📦 Gestionar importación y exportación →`
- Navega a `ImportarExportarScreen` vía Stack navigator

## Navegación

Agregar al Stack en `RootNavigator.tsx`:
```
Stack.Screen name="ImportarExportar" component={ImportarExportarScreen}
  options={{ headerShown: true, title: 'Importar / Exportar' }}
```

## Archivo nuevo

`src/screens/ImportarExportarScreen.tsx`

## Estado local

```ts
tab: 'importar' | 'exportar'

// Paso 1 exportar
inclNotas: boolean
inclEvaluaciones: boolean
inclHorarios: boolean
perfilesSelec: string[]   // IDs de perfiles seleccionados

// Paso 2 exportar
metodo: 'json' | 'qr_pantalla' | 'qr_descarga' | null
formatoDescarga: 'png' | 'pdf' | 'zip' | null
```

## Panel Importar

### Opción 1: archivo .json
- Botón `📂 Seleccionar archivo .json`
- Usa `fileIO.importarArchivo()` (funciona en web, Tauri y móvil)
- Detecta automáticamente el formato por estructura:
  - Array de objetos con campo `nombre` + `semestre` → carrera (`jsonAMaterias`)
  - Objeto con campo `version` + `perfiles` → formato propio de esta app
  - Objeto con bloques de horario → horarios
  - Desconocido → alerta con mensaje claro
- Muestra texto explicativo: "Los formatos aceptados son los generados por los prompts IA de esta app (Configuración → Prompts IA)"

### Opción 2: escanear QR
- Solo visible en móvil (`Platform.OS !== 'web'`)
- Botón `📷 Abrir escáner` → abre `QrScannerModal` existente

## Panel Exportar

### Paso 1: ¿Qué exportar?
- Materias: siempre incluido, no toggle (checkbox deshabilitado marcado)
- Notas: toggle checkbox
- Evaluaciones: toggle checkbox
- Horarios: toggle checkbox
- Perfiles: checkboxes por cada perfil (nombre + indicador "activo")

### Paso 2: ¿Cómo exportar?
Tres botones:
1. `📄 Descargar .json` → genera y descarga un archivo
2. `📱 Ver QRs en pantalla` → abre `QrShareModal` existente
3. `🖼️ Descargar QRs` → muestra sub-opciones: PNG por QR | PDF | ZIP

## Formato del JSON exportado

```ts
type ExportPayload = {
  version: 1;
  exportadoEn: string;        // ISO date
  perfiles: {
    id: string;
    nombre: string;
    materias: MateriaJson[];
    notas?: Record<string, number | null>;      // materia.id → notaManual
    evaluaciones?: Record<string, Evaluacion[]>; // materia.id → evaluaciones
    horarios?: BloqueHorario[];
  }[];
}
```

## Descarga de QRs

- **PNG por QR**: captura cada QR con `react-native-view-shot` (móvil) o canvas HTML (web/Tauri)
- **PDF**: genera con `expo-print` (móvil) o `window.print()` (web/Tauri)
- **ZIP**: genera con `jszip` (web/Tauri) o comparte archivos individuales (móvil)

## Dependencias nuevas

- `react-native-view-shot` — captura de QR como imagen
- `expo-print` — generación de PDF en móvil
- `jszip` — generación de ZIP en web/Tauri

## Restricciones por plataforma

| Feature | Móvil | Web | Tauri |
|---|---|---|---|
| Importar .json | ✅ | ✅ | ✅ |
| Escanear QR | ✅ | ❌ | ❌ |
| Ver QRs 1x1 | ✅ | ✅ | ✅ |
| Descargar PNG | ✅ | ✅ | ✅ |
| Descargar PDF | ✅ | ✅ | ✅ |
| Descargar ZIP | ✅ | ✅ | ✅ |
