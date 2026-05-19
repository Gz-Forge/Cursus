# Design: Personalización de colores e iconos por estado de materia

**Fecha:** 2026-05-19  
**Rama:** feat/config-tabs  

## Problema

Los colores e iconos de los estados de materia (`aprobado`, `exonerado`, `cursando`, `por_cursar`, `reprobado`, `recursar`) están hardcodeados en `theme/colors.ts` y en constantes locales de cada componente. El usuario no puede personalizarlos.

## Solución aprobada: Hook centralizado `useEstadoEstilo` (Enfoque A)

### 1. Nuevos campos en `Config` (`src/types/index.ts`)

```ts
estadoColoresPersonalizados?: Partial<Record<EstadoMateria, string>>;  // hex, ej: '#4CAF50'
estadoIconosPersonalizados?:  Partial<Record<EstadoMateria, string>>;  // emoji string, ej: '✅'
```

- Opcionales — ausencia/undefined = usar defaults de `colors.ts`
- No requieren migración (Zustand hace spread con `CONFIG_DEFAULT` al cargar)
- Se sincronizan entre dispositivos automáticamente vía `DeviceSyncPayload` (son strings en `config`)

### 2. Hook `useEstadoEstilo` (`src/hooks/useEstadoEstilo.ts`)

```ts
import { useStore } from '../store/useStore';
import { estadoColores } from '../theme/colors';
import { EstadoMateria } from '../types';

const ICONOS_DEFAULT: Record<EstadoMateria, string> = {
  aprobado: '✅', exonerado: '⭐', cursando: '🔵',
  por_cursar: '⬜', reprobado: '🟠', recursar: '🔴',
};

export function useEstadoEstilo() {
  const config = useStore(s => s.config);

  const getColor = (estado: EstadoMateria): string =>
    config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado];

  const getIcono = (estado: EstadoMateria): string =>
    config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado];

  return { getColor, getIcono };
}
```

### 3. Archivos a migrar

Reemplazar uso directo de `estadoColores[e]` y constantes `ICONOS` locales por el hook:

| Archivo | Cambio |
|---------|--------|
| `src/components/MateriaCard.tsx` | Eliminar `ICONOS` local, usar `getColor`/`getIcono` |
| `src/screens/CarreraScreen.tsx` | Reemplazar `estadoColores[e]` y `ESTADO_LABELS` con emojis dinámicos |
| `src/screens/MetricsScreen.tsx` | Reemplazar `estadoColores` y `ESTADO_LABELS` con emojis dinámicos |

Labels compuestos (ej: `"✅ Aprobadas"`) se arman dinámicamente: `` `${getIcono('aprobado')} Aprobadas` ``

### 4. UI en ConfigScreen — panel App

Nueva sección **"ESTADOS DE MATERIA"** debajo de "TARJETAS DE MATERIA":

- Header colapsable con botón global "Restaurar todos"
- Lista de 6 estados; cada uno es una fila expandible que muestra:
  - Preview en tiempo real: cuadrado de color + emoji actual
  - Al expandir: `ColorInput` existente (paleta + hex) + `TextInput` para emoji (max 2 chars)
  - Botón "Restaurar" individual por estado
- Reutiliza el componente `ColorInput` ya existente en `ConfigScreen`

### 5. Sincronización entre dispositivos

Sin cambios en `deviceSnapshot.ts`. Los nuevos campos son strings dentro de `config`, que ya se incluye en el payload de sync. `temaPersonalizado` sigue siendo el único campo excluido del sync.

## Defaults de referencia

| Estado | Color default | Icono default |
|--------|--------------|---------------|
| aprobado | `#4CAF50` | ✅ |
| exonerado | `#FFD700` | ⭐ |
| cursando | `#2196F3` | 🔵 |
| por_cursar | `#9E9E9E` | ⬜ |
| reprobado | `#FF9800` | 🟠 |
| recursar | `#F44336` | 🔴 |
