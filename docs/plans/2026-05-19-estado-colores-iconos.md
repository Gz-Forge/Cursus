# Estado Colores e Iconos Personalizables — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir al usuario personalizar el color hex y el emoji de cada estado de materia (aprobado, exonerado, cursando, por_cursar, reprobado, recursar), reflejándose en toda la app.

**Architecture:** Se agregan dos campos opcionales a `Config`, se crea un hook `useEstadoEstilo` que resuelve el valor personalizado o el default, y se migran los 3 archivos que consumen `estadoColores` directamente. La UI se agrega en ConfigScreen panel `app`.

**Tech Stack:** React Native, Expo, Zustand, TypeScript. Sin librerías nuevas.

---

### Task 1: Agregar campos a `Config`

**Files:**
- Modify: `src/types/index.ts:138-192`

**Step 1: Agregar los dos campos opcionales al final de la interfaz `Config`**

Ubicar la línea `semestreExpandidoMap?: Record<string, boolean>;` (última línea de Config, aprox línea 191) y agregar debajo:

```ts
  estadoColoresPersonalizados?: Partial<Record<EstadoMateria, string>>;
  estadoIconosPersonalizados?: Partial<Record<EstadoMateria, string>>;
```

La interfaz queda así al final:
```ts
  semestreExpandidoMap?: Record<string, boolean>;
  estadoColoresPersonalizados?: Partial<Record<EstadoMateria, string>>;
  estadoIconosPersonalizados?: Partial<Record<EstadoMateria, string>>;
}
```

**Step 2: Verificar que TypeScript no rompe**

```bash
cd TablaApp && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores relacionados a los nuevos campos (pueden haber otros pre-existentes).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(tipos): agregar estadoColoresPersonalizados e estadoIconosPersonalizados a Config"
```

---

### Task 2: Crear hook `useEstadoEstilo`

**Files:**
- Create: `src/hooks/useEstadoEstilo.ts`

**Step 1: Crear el directorio y el archivo**

```bash
mkdir -p src/hooks
```

Crear `src/hooks/useEstadoEstilo.ts` con este contenido exacto:

```ts
import { useStore } from '../store/useStore';
import { estadoColores } from '../theme/colors';
import { EstadoMateria } from '../types';

export const ICONOS_DEFAULT: Record<EstadoMateria, string> = {
  aprobado:  '✅',
  exonerado: '⭐',
  cursando:  '🔵',
  por_cursar: '⬜',
  reprobado: '🟠',
  recursar:  '🔴',
};

export const ESTADO_NOMBRES: Record<EstadoMateria, string> = {
  aprobado:  'Aprobadas',
  exonerado: 'Exoneradas',
  cursando:  'Cursando',
  por_cursar: 'Por cursar',
  reprobado: 'Reprobadas',
  recursar:  'Recursar',
};

export function useEstadoEstilo() {
  const config = useStore(s => s.config);

  const getColor = (estado: EstadoMateria): string =>
    config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado];

  const getIcono = (estado: EstadoMateria): string =>
    config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado];

  /** Devuelve "icono + espacio + nombre", ej: "✅ Aprobadas" */
  const getLabel = (estado: EstadoMateria): string =>
    `${getIcono(estado)} ${ESTADO_NOMBRES[estado]}`;

  return { getColor, getIcono, getLabel };
}
```

> Nota: exportamos `ICONOS_DEFAULT` y `ESTADO_NOMBRES` para poder usarlos en ConfigScreen sin repetir datos.

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/hooks/useEstadoEstilo.ts
git commit -m "feat(hook): crear useEstadoEstilo con getColor, getIcono y getLabel"
```

---

### Task 3: Migrar `MateriaCard.tsx`

**Files:**
- Modify: `src/components/MateriaCard.tsx`

Cambios necesarios:
1. Eliminar import de `estadoColores`
2. Eliminar constante `ICONOS` local
3. Agregar import del hook
4. Llamar al hook dentro del componente
5. Reemplazar `ICONOS[estado]` → `icono` y `estadoColores[estado]` → `color` (ya están en variables, solo cambiar de dónde vienen)
6. Reemplazar `estadoColores.cursando` (línea ~170) → `getColor('cursando')`

**Step 1: Reemplazar el import**

Cambiar:
```ts
import { estadoColores } from '../theme/colors';
```
Por:
```ts
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
```

**Step 2: Eliminar la constante `ICONOS` local**

Eliminar estas líneas (aprox líneas 8-10):
```ts
const ICONOS: Record<EstadoMateria, string> = {
  aprobado: '✅', exonerado: '⭐', cursando: '🔵', por_cursar: '⬜', reprobado: '🟠', recursar: '🔴',
};
```

**Step 3: Llamar al hook dentro del componente y ajustar variables**

Dentro de `MateriaCard` (aprox línea 51, después de `const tema = useTema();`), agregar:
```ts
const { getColor, getIcono } = useEstadoEstilo();
```

Luego cambiar las líneas de derivación de `icono` y `color`:
```ts
// Antes:
const icono = ICONOS[estado];
const color = estadoColores[estado];

// Después:
const icono = getIcono(estado);
const color = getColor(estado);
```

**Step 4: Reemplazar `estadoColores.cursando` en el Switch**

Buscar la línea con `trackColor={{ true: estadoColores.cursando }}` (aprox línea 170) y cambiar a:
```tsx
trackColor={{ true: getColor('cursando') }}
```

**Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/components/MateriaCard.tsx
git commit -m "feat(tarjeta): migrar MateriaCard a useEstadoEstilo"
```

---

### Task 4: Migrar `CarreraScreen.tsx`

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

Cambios necesarios:
1. Eliminar import de `estadoColores`
2. Eliminar constante `ESTADO_LABELS` local
3. Agregar import del hook + `ICONOS_DEFAULT`
4. Llamar al hook dentro del componente
5. Reemplazar `estadoColores[e]` → `getColor(e)`
6. Reemplazar `ESTADO_LABELS[e]` → `getLabel(e)`

**Step 1: Actualizar imports**

Cambiar:
```ts
import { estadoColores, temaOscuro } from '../theme/colors';
```
Por:
```ts
import { temaOscuro } from '../theme/colors';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
```

**Step 2: Eliminar `ESTADO_LABELS` local**

Eliminar estas líneas (aprox líneas 27-31):
```ts
const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};
```

**Step 3: Llamar al hook dentro de `CarreraScreen`**

Al comienzo del cuerpo del componente `CarreraScreen` (después de los `useStore`, `useState`, etc.), agregar:
```ts
const { getColor, getLabel } = useEstadoEstilo();
```

**Step 4: Reemplazar usos**

Línea ~584 — cambiar:
```tsx
style={{ ... backgroundColor: filtroEstado === e ? estadoColores[e] : tema.tarjeta }}
...
<Text ...>{ESTADO_LABELS[e]}</Text>
```
Por:
```tsx
style={{ ... backgroundColor: filtroEstado === e ? getColor(e) : tema.tarjeta }}
...
<Text ...>{getLabel(e)}</Text>
```

**Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat(carrera): migrar CarreraScreen a useEstadoEstilo"
```

---

### Task 5: Migrar `MetricsScreen.tsx`

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

Cambios necesarios:
1. Eliminar import de `estadoColores`
2. Eliminar constante `ESTADO_LABELS` local (líneas 17-21)
3. Agregar import del hook
4. Llamar al hook dentro del componente
5. Reemplazar todos los `estadoColores[e]`, `estadoColores[estado]` y `ESTADO_LABELS[e]`

**Step 1: Actualizar imports**

Cambiar:
```ts
import { estadoColores } from '../theme/colors';
```
Por:
```ts
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
```

**Step 2: Eliminar `ESTADO_LABELS` local**

Eliminar estas líneas (aprox líneas 17-21):
```ts
const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};
```

**Step 3: Llamar al hook dentro de `MetricsScreen`**

Al comienzo del cuerpo del componente (después de los hooks de store/tema), agregar:
```ts
const { getColor, getLabel } = useEstadoEstilo();
```

**Step 4: Reemplazar todos los usos — 6 ocurrencias**

| Línea aprox | Antes | Después |
|------------|-------|---------|
| 680 | `backgroundColor: estadoColores[e]` | `backgroundColor: getColor(e)` |
| 697 | `backgroundColor: estadoColores[e]` | `backgroundColor: getColor(e)` |
| 703 | `{ESTADO_LABELS[e]}` | `{getLabel(e)}` |
| 704 | `color: estadoColores[e]` | `color: getColor(e)` |
| 770 | `backgroundColor: estadoColores[estado]` | `backgroundColor: getColor(estado)` |
| 912 | `backgroundColor: estadoColores[calcularEstadoFinal(mat, config)]` | `backgroundColor: getColor(calcularEstadoFinal(mat, config))` |
| 923 | `backgroundColor: estadoColores[e]` | `backgroundColor: getColor(e)` |
| 924 | `{ESTADO_LABELS[e].split(' ').slice(1).join(' ')}` | `{getLabel(e).split(' ').slice(1).join(' ')}` |

> Nota línea 924: el `.split(' ').slice(1).join(' ')` ya existía para quitar el emoji del label compuesto. Con el hook sigue funcionando igual porque `getLabel` devuelve `"emoji nombre"`.

**Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "feat(metricas): migrar MetricsScreen a useEstadoEstilo"
```

---

### Task 6: UI de personalización en `ConfigScreen`

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

Agregar la sección "ESTADOS DE MATERIA" en el panel `app`, justo antes del cierre `</>` de `tabActiva === 'app'` (actualmente en línea ~275).

**Step 1: Agregar imports necesarios al inicio del archivo**

Al import de tipos existente:
```ts
import { TipoBloque, ColorBloque, EvaluacionSimple } from '../types';
```
Agregar `EstadoMateria`:
```ts
import { TipoBloque, ColorBloque, EvaluacionSimple, EstadoMateria } from '../types';
```

Agregar imports del hook:
```ts
import { useEstadoEstilo, ICONOS_DEFAULT, ESTADO_NOMBRES } from '../hooks/useEstadoEstilo';
import { estadoColores } from '../theme/colors';
```

**Step 2: Agregar estado local para filas expandidas**

Dentro del componente `ConfigScreen`, después de los `useState` existentes, agregar:
```ts
const [estadoExpandido, setEstadoExpandido] = useState<EstadoMateria | null>(null);
```

**Step 3: Llamar al hook dentro del componente**

```ts
const { getColor, getIcono } = useEstadoEstilo();
```

**Step 4: Definir constante de orden de estados (local en ConfigScreen)**

```ts
const ORDEN_ESTADOS_CONFIG: EstadoMateria[] = [
  'exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar',
];
```

**Step 5: Insertar la sección completa en el panel `app`**

Localizar la línea:
```tsx
          </>
          )}

          {tabActiva === 'notas' && (
```

Insertar antes del `</>` de cierre del bloque `app`:

```tsx
          {/* ── ESTADOS DE MATERIA ──────────────────────── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600' }}>ESTADOS DE MATERIA</Text>
            <TouchableOpacity
              onPress={() => actualizarConfig({
                estadoColoresPersonalizados: undefined,
                estadoIconosPersonalizados: undefined,
              })}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar todos</Text>
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
            {ORDEN_ESTADOS_CONFIG.map((estado, idx) => {
              const color = getColor(estado);
              const icono = getIcono(estado);
              const expandido = estadoExpandido === estado;
              const esUltimo = idx === ORDEN_ESTADOS_CONFIG.length - 1;

              return (
                <View key={estado}>
                  {/* Fila header */}
                  <TouchableOpacity
                    onPress={() => setEstadoExpandido(expandido ? null : estado)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 14,
                      borderBottomWidth: expandido || !esUltimo ? 1 : 0,
                      borderBottomColor: tema.borde,
                    }}
                  >
                    {/* Preview color */}
                    <View style={{
                      width: 22, height: 22, borderRadius: 5,
                      backgroundColor: color, marginRight: 10,
                    }} />
                    {/* Preview icono */}
                    <Text style={{ fontSize: 18, marginRight: 10 }}>{icono}</Text>
                    {/* Nombre estado */}
                    <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }}>
                      {ESTADO_NOMBRES[estado]}
                    </Text>
                    {/* Chevron */}
                    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                      {expandido ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {/* Panel expandido */}
                  {expandido && (
                    <View style={{
                      backgroundColor: tema.fondo, padding: 14,
                      borderBottomWidth: esUltimo ? 0 : 1,
                      borderBottomColor: tema.borde,
                    }}>
                      {/* Color picker */}
                      <ColorInput
                        label="Color"
                        value={config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado]}
                        onChange={v => actualizarConfig({
                          estadoColoresPersonalizados: {
                            ...config.estadoColoresPersonalizados,
                            [estado]: v,
                          },
                        })}
                      />

                      {/* Emoji picker */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>Icono</Text>
                        <TextInput
                          style={{
                            flex: 1, backgroundColor: tema.superficie,
                            color: tema.texto, padding: 8, borderRadius: 6,
                            fontSize: 22, textAlign: 'center',
                            borderWidth: 1, borderColor: tema.borde,
                          }}
                          value={config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado]}
                          onChangeText={v => {
                            // Tomar solo el primer "carácter visible" (un emoji puede ser varios code points)
                            const trimmed = v.trim();
                            if (!trimmed) return;
                            actualizarConfig({
                              estadoIconosPersonalizados: {
                                ...config.estadoIconosPersonalizados,
                                [estado]: trimmed,
                              },
                            });
                          }}
                          placeholder={ICONOS_DEFAULT[estado]}
                          placeholderTextColor={tema.textoSecundario}
                        />
                      </View>

                      {/* Restaurar individual */}
                      <TouchableOpacity
                        onPress={() => {
                          const nuevosCols = { ...config.estadoColoresPersonalizados };
                          const nuevosIcons = { ...config.estadoIconosPersonalizados };
                          delete nuevosCols[estado];
                          delete nuevosIcons[estado];
                          actualizarConfig({
                            estadoColoresPersonalizados: Object.keys(nuevosCols).length ? nuevosCols : undefined,
                            estadoIconosPersonalizados: Object.keys(nuevosIcons).length ? nuevosIcons : undefined,
                          });
                        }}
                        style={{
                          alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6,
                          borderRadius: 8, borderWidth: 1, borderColor: tema.borde,
                        }}
                      >
                        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
```

**Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Commit final**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): sección ESTADOS DE MATERIA con personalización de color e icono"
```

---

### Task 7: Smoke test manual

Verificar en la app (Expo Go o build de dev):

1. Ir a **Configuración → App → ESTADOS DE MATERIA**
2. Expandir "Aprobadas" → cambiar color a `#FF0000` y emoji a `🎯`
3. Confirmar que la tarjeta de una materia aprobada muestra `🎯` en rojo
4. Confirmar que en **Métricas → Materias por estado** aparece `🎯 Aprobadas` en rojo
5. Confirmar que en **Carrera** el chip de filtro "Aprobadas" usa el nuevo color
6. Tocar **Restaurar** en ese estado → vuelve a `✅` verde
7. Cambiar otro estado, luego tocar **Restaurar todos** → todos vuelven a defaults
8. Verificar sync: exportar QR desde dispositivo A, importar en dispositivo B → los colores/iconos personalizados se transfieren

---

### Notas de implementación

- **No tocar** `src/utils/deviceSnapshot.ts` — sync funciona solo
- **No tocar** `src/theme/colors.ts` — los defaults permanecen como fuente de verdad
- El `TextInput` de emoji no limita a 1 carácter porque un emoji Unicode puede ocupar múltiples code points (`trimmed` toma todo lo que el usuario escriba, que en la práctica es 1 emoji del teclado)
- `delete nuevosCols[estado]` en el restaurar individual es correcto: si el objeto queda vacío se guarda `undefined` para no contaminar el config con objetos vacíos
