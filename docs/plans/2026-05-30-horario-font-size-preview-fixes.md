# Horario Font Size + Preview Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar control de tamaño de texto en bloques del horario y corregir los previews de Carrera, Horarios y Métricas en TemaPersonalizadoScreen.

**Architecture:** Campo `horarioFontSize?: number` en `Config` (universal, todos los temas). El stepper vive en `PantallaEditor` solo cuando `pantallaKey === 'horario'`, llama `actualizarConfig` directamente (efecto inmediato). Los previews se corrigen para reflejar la UI real por plataforma.

**Tech Stack:** React Native / Expo, TypeScript, Zustand (useStore), Platform.OS checks

---

## Task 1: Agregar `horarioFontSize` al tipo Config

**Files:**
- Modify: `src/types/index.ts:186-190`

**Step 1: Agregar campo en la interfaz `Config`**

En `src/types/index.ts`, dentro del bloque de campos de horario (después de `horarioFiltroOcultarEvaluaciones` en línea ~190), agregar:

```ts
  horarioFontSize?: number;              // undefined → fallback por plataforma (web=12, móvil=8). Rango: 6–20.
```

**Step 2: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores nuevos (el campo es opcional, no rompe nada).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add horarioFontSize optional field to Config"
```

---

## Task 2: Usar `horarioFontSize` en HorarioScreen

**Files:**
- Modify: `src/screens/HorarioScreen.tsx:34-35`

**Step 1: Convertir constantes a valores dinámicos**

`BLOCK_FONT` y `BLOCK_LINE_H` son constantes de módulo en líneas 34-35. Hay que convertirlas a valores calculados dentro del componente `HorarioScreen`.

Reemplazar las líneas 34-35:
```ts
const BLOCK_FONT   = Platform.OS === 'web' ? 12 : 8;
const BLOCK_LINE_H = Platform.OS === 'web' ? 16 : 11;
```

Por (dentro del cuerpo del componente `HorarioScreen`, justo después de `const { materias, config, actualizarConfig } = useStore();` en línea ~82):
```ts
  const BLOCK_FONT   = config.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8);
  const BLOCK_LINE_H = BLOCK_FONT + 4;
```

**Importante:** Las constantes en líneas 34-35 del módulo deben eliminarse. `BLOCK_FONT` y `BLOCK_LINE_H` pasan a ser variables locales del componente.

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

**Step 3: Verificar visual**

Abrir la app, ir a Horario. El horario debe verse igual que antes (porque `horarioFontSize` es `undefined` → usa fallback). Ir a Configuración → Personalizar tema → Horarios (en el siguiente task se agrega el stepper, por ahora solo verificar que no crashea).

**Step 4: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): use config.horarioFontSize for block text size"
```

---

## Task 3: Renombrar labels y sección en TemaPersonalizadoScreen

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:157-159` (PANTALLAS)
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:1212` (título sección)
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:1273-1276` (selector preview)

**Step 1: Renombrar labels en array PANTALLAS (línea 157-159)**

```ts
// Antes
  { key: 'horario',  label: 'Horario' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'config',   label: 'Config' },

// Después
  { key: 'horario',  label: 'Horarios'      },
  { key: 'metricas', label: 'Métricas'       },
  { key: 'config',   label: 'Configuración' },
```

**Step 2: Renombrar título de sección (línea 1212)**

```ts
// Antes
<Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>COLORES Y FONDOS POR PANTALLA</Text>

// Después
<Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>CONFIGURACIÓN POR PANTALLA</Text>
```

**Step 3: Renombrar labels en selector del panel preview (líneas 1273-1276)**

```ts
// Antes
  ['carrera',  'Carrera'],
  ['horario',  'Horario'],
  ['metricas', 'Métricas'],
  ['config',   'Config'],

// Después
  ['carrera',  'Carrera'       ],
  ['horario',  'Horarios'      ],
  ['metricas', 'Métricas'      ],
  ['config',   'Configuración' ],
```

**Step 4: Commit**

```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "feat(tema): rename section and screen labels for consistency"
```

---

## Task 4: Agregar stepper de font size en PantallaEditor

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:194-384` (PantallaEditor)

**Step 1: Agregar acceso a config en PantallaEditor**

`PantallaEditor` ya llama a `useStore` en línea 217. Agregar otra llamada justo debajo:

```ts
  const materiasAll = useStore(s => s.materias);
  // --- agregar esta línea ---
  const { config: appConfig, actualizarConfig } = useStore(s => ({ config: s.config, actualizarConfig: s.actualizarConfig }));
```

**Step 2: Agregar sección de stepper al final del return de PantallaEditor**

Dentro del `return` de `PantallaEditor`, justo antes del cierre `</View>` final (línea 382), agregar el bloque condicional:

```tsx
      {pantallaKey === 'horario' && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
            TAMAÑO DE TEXTO EN BLOQUES
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: Math.max(6, (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) - 1) })}
              disabled={(appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) <= 6}
              style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: tema.fondo, alignItems: 'center', justifyContent: 'center',
                opacity: (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) <= 6 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: tema.texto, fontSize: 20, fontWeight: '700' }}>−</Text>
            </TouchableOpacity>

            <View style={{ minWidth: 44, alignItems: 'center' }}>
              <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700' }}>
                {appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: Math.min(20, (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) + 1) })}
              disabled={(appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) >= 20}
              style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: tema.fondo, alignItems: 'center', justifyContent: 'center',
                opacity: (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) >= 20 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: tema.texto, fontSize: 20, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: undefined })}
              style={{ marginLeft: 8 }}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 6 }}>
            Por defecto: web 12 · móvil 8 · Mín 6 · Máx 20{'\n'}Se aplica de inmediato.
          </Text>
        </View>
      )}
```

**Nota:** `Platform` ya está importado en el archivo (línea 5). `TouchableOpacity` también.

**Step 3: Verificar visual**

Abrir Personalizar tema → tab Horarios → verificar que aparece el stepper. Probar `−`/`+` y que el tamaño en HorarioScreen cambia en tiempo real.

**Step 4: Commit**

```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "feat(tema): add font size stepper for horario blocks in PantallaEditor"
```

---

## Task 5: Fix HorarioPreview — botones correctos + font size dinámico

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:548-648` (HorarioPreview)

**Step 1: Agregar acceso a config en HorarioPreview**

Dentro de `HorarioPreview`, después de `const t = draft;` en línea 550, agregar:

```ts
  const appConfig = useStore(s => s.config);
  const blockFont = appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8);
```

**Step 2: Reemplazar botones 📥/📤 por botones reales**

Reemplazar el bloque de botones (líneas 580-588):
```tsx
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {['📥', '📤'].map((icono, i) => (
            <View key={i} style={{ backgroundColor: t.tarjeta, paddingHorizontal: 7, paddingVertical: 4,
              borderRadius: 6, borderWidth: 1, borderColor: t.acentoLineas ?? t.acento, alignItems: 'center' }}>
              <Text style={{ fontSize: 12 }}>{icono}</Text>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 8, fontWeight: '600' }}>{i === 0 ? 'Import' : 'Export'}</Text>
            </View>
          ))}
        </View>
```

Por:
```tsx
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {([
            { label: '📦 Datos',   hasIndicator: false },
            { label: '🔽 Filtrar', hasIndicator: true  },
          ]).map(({ label, hasIndicator }) => (
            <View key={label} style={{
              backgroundColor: t.tarjeta, paddingHorizontal: 8, paddingVertical: 5,
              borderRadius: 6, borderWidth: 1, borderColor: t.acentoLineas ?? t.acento,
              flexDirection: 'row', alignItems: 'center', gap: 2,
            }}>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 9, fontWeight: '600' }}>{label}</Text>
              {hasIndicator && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.acentoFondo ?? t.acento }} />
              )}
            </View>
          ))}
        </View>
```

**Step 3: Usar font size dinámico en los bloques**

Reemplazar línea 639:
```tsx
// Antes
<Text style={{ color: b.texto, fontSize: 7, fontWeight: '700', lineHeight: 10 }}

// Después
<Text style={{ color: b.texto, fontSize: blockFont, fontWeight: '700', lineHeight: blockFont + 3 }}
```

**Step 4: Commit**

```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "fix(preview): fix HorarioPreview buttons and dynamic font size"
```

---

## Task 6: Fix MetricasPreview — ⚙️, colores de estado, 2 columnas, gráficos mejorados

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:9-10` (imports)
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:651-828` (MetricasPreview)

**Step 1: Agregar import de `estadoColores`**

En línea 10, el import de colors es:
```ts
import { temaOscuro } from '../theme/colors';
```

Cambiarlo a:
```ts
import { temaOscuro, estadoColores } from '../theme/colors';
```

**Step 2: Agregar acceso a config en MetricasPreview**

Dentro de `MetricasPreview`, después de `const { getLabel } = useEstadoEstilo();` en línea ~653, agregar:

```ts
  const appConfig = useStore(s => s.config);
  const isWeb = Platform.OS === 'web';

  // Colores de estado con override personalizado
  const EC = {
    exonerado: appConfig.estadoColoresPersonalizados?.exonerado ?? estadoColores.exonerado,
    aprobado:  appConfig.estadoColoresPersonalizados?.aprobado  ?? estadoColores.aprobado,
    cursando:  appConfig.estadoColoresPersonalizados?.cursando  ?? estadoColores.cursando,
    por_cursar:appConfig.estadoColoresPersonalizados?.por_cursar?? estadoColores.por_cursar,
    reprobado: appConfig.estadoColoresPersonalizados?.reprobado ?? estadoColores.reprobado,
    recursar:  appConfig.estadoColoresPersonalizados?.recursar  ?? estadoColores.recursar,
  };
```

Eliminar la constante `EC` hardcodeada que existe actualmente en línea ~656:
```ts
// ELIMINAR esta línea:
const EC = { exonerado: '#FFD700', aprobado: '#4CAF50', cursando: '#2196F3', por_cursar: '#9E9E9E', reprobado: '#FF9800', recursar: '#F44336' };
```

**Step 3: Agregar botón ⚙️ en el header de tabs**

En MetricasPreview, el bloque de tabs (línea ~664-675):
```tsx
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 2 }}>
        {(['general', 'graficos'] as const).map(p => (
          ...
        ))}
      </View>
```

Reemplazar por:
```tsx
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 2, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {(['general', 'graficos'] as const).map(p => (
            <TouchableOpacity key={p} onPress={() => setPanel(p)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center',
                borderBottomWidth: 2, borderBottomColor: panel === p ? (t.acentoLineas ?? t.acento) : 'transparent' }}>
              <Text style={{ color: panel === p ? (t.acentoTexto ?? t.acento) : t.textoSecundario, fontWeight: '600', fontSize: 13 }}>
                {p === 'general' ? 'General' : 'Gráficos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </View>
      </View>
```

**Step 4: Aplicar 2 columnas en web para el panel General**

El panel General tiene varios bloques de métricas (PROGRESO GENERAL, AVANCE POR AÑO, etc.). Envolverlos en un contenedor que en web los pone en 2 columnas.

Dentro del bloque `{panel === 'general' && (...)}`, envolver el contenido en:
```tsx
      {panel === 'general' && (
        <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
          {/* cada SecTitulo + View de métrica se envuelve en: */}
          {/* <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}> ... </View> */}
          ...
        </View>
      )}
```

Concretamente, cada bloque individual (PROGRESO GENERAL, AVANCE POR AÑO, MATERIAS POR ESTADO, CRÉDITOS POR SEMESTRE) se envuelve en:
```tsx
<View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
  <SecTitulo title="..." />
  <View style={{ backgroundColor: t.tarjeta, ... }}>
    ...
  </View>
</View>
```

**Step 5: Mejorar gráficos en panel Gráficos**

En el panel Gráficos, reemplazar los 3 charts existentes por versiones más representativas:

**Promedio por semestre** — agregar línea de área (polígono aproximado):
```tsx
          <SecTitulo title="PROMEDIO POR SEMESTRE" />
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              {/* Área chart simulada con bars + línea superior */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4, marginBottom: 4 }}>
                {[{ v: 9.5, s: '1°' }, { v: 8.2, s: '2°' }, { v: 7.8, s: '3°' }, { v: 10.1, s: '4°' }].map((d, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      width: '80%',
                      height: d.v * 5,
                      backgroundColor: `${t.acentoGraficos ?? t.acento}55`,
                      borderRadius: 2,
                      borderTopWidth: 2,
                      borderTopColor: t.acentoGraficos ?? t.acento,
                    }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 8, marginTop: 2 }}>{d.s}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: t.textoSecundario, fontSize: 9, textAlign: 'center' }}>Promedio por semestre</Text>
            </View>
          </View>
```

**Notas obtenidas** — barras verticales (mantener las existentes pero con mejor proporción y en 2 col si web):
```tsx
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="DISTRIBUCIÓN POR NOTA" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 6, paddingBottom: 4 }}>
                {[
                  { h: 14, color: EC.recursar,  label: getLabel('recursar')  },
                  { h: 24, color: EC.reprobado, label: getLabel('reprobado') },
                  { h: 10, color: EC.aprobado,  label: getLabel('aprobado')  },
                  { h: 52, color: EC.exonerado, label: getLabel('exonerado') },
                ].map(b => (
                  <View key={b.label} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '75%', height: b.h, backgroundColor: b.color, borderRadius: 3 }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 7, marginTop: 3 }} numberOfLines={1}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
```

**Tipos de formación** — donut/anillo:
```tsx
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="TIPOS DE FORMACIÓN" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2, alignItems: 'center' }}>
              {/* Donut simulado con 2 Views concéntricas */}
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: t.acentoGraficos ?? t.acento, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.tarjeta }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  { label: 'Obligatoria', color: t.acentoGraficos ?? t.acento },
                  { label: 'Optativa',    color: t.acento                     },
                ].map(item => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 9 }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
```

**Step 6: Commit**

```bash
git add src/screens/TemaPersonalizadoScreen.tsx src/theme/colors.ts
git commit -m "fix(preview): MetricasPreview - gear button, estado colors, 2-col web, improved charts"
```

---

## Task 7: Fix CarreraPreview — grid 2 columnas + tab Búsqueda mejorado

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx:409-546` (CarreraPreview)

**Step 1: Agregar `isWeb` y `modoSearch` state en CarreraPreview**

Dentro de `CarreraPreview`, agregar después del `useState` existente:

```ts
  const isWeb = Platform.OS === 'web';
  const [modoSearch, setModoSearch] = useState<'nombre' | 'es_previa' | 'sus_previas'>('nombre');
```

**Step 2: Aplicar grid 2 columnas en tabs Carrera y Semestre**

El componente `MCard` se renderiza en listas. Donde se renderizan (`sem.materias.map(m => <MCard key={m.num} m={m} />)` y `semestresData[0].materias.map(m => <MCard key={m.num} m={m} />)`), envolver cada lista en un contenedor con flex wrap:

```tsx
{/* Tab Carrera — lista de materias por semestre */}
<View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
  {sem.materias.map(m => (
    <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
      <MCard m={m} />
    </View>
  ))}
</View>

{/* Tab Semestre */}
<View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
  {semestresData[0].materias.map(m => (
    <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
      <MCard m={m} />
    </View>
  ))}
</View>
```

**Step 3: Reemplazar tab Búsqueda con versión completa**

Reemplazar el bloque `{tab === 'busqueda' && (...)}` (líneas 512-543) por:

```tsx
      {tab === 'busqueda' && (
        <>
          {/* Search bar */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: t.tarjeta, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6,
            marginBottom: 10, gap: 6,
          }}>
            <Text style={{ color: t.textoSecundario, fontSize: 13 }}>🔍</Text>
            <Text style={{ color: t.textoSecundario, fontSize: 12, flex: 1 }}>Buscar materia...</Text>
            <Text style={{ color: t.textoSecundario, fontSize: 13 }}>✕</Text>
          </View>

          {/* Chips de modo */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {([
              { key: 'nombre'     as const, label: 'Nombre'       },
              { key: 'es_previa'  as const, label: 'Es previa de' },
              { key: 'sus_previas'as const, label: 'Sus previas'  },
            ]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setModoSearch(key)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                  backgroundColor: modoSearch === key ? (t.acentoFondo ?? t.acento) : t.tarjeta,
                }}
              >
                <Text style={{
                  color: modoSearch === key ? '#fff' : t.textoSecundario,
                  fontSize: 11,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Indicador de referencia */}
          {modoSearch !== 'nombre' && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: `${t.acentoFondo ?? t.acento}22`,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
              marginBottom: 10,
            }}>
              <Text style={{ fontSize: 12 }}>📌</Text>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 11 }}>Referencia: Álgebra I</Text>
            </View>
          )}

          {/* Filtros Todas / Para cursar / Para dar examen */}
          <Text style={{ color: t.textoSecundario, fontSize: 11, marginBottom: 4 }}>Mostrar</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Todas',          active: true  },
              { label: 'Para cursar',    active: false },
              { label: 'Para examen',    active: false },
            ].map(f => (
              <View key={f.label} style={{
                flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                backgroundColor: f.active ? (t.acentoFondo ?? t.acento) : t.tarjeta,
              }}>
                <Text style={{ color: f.active ? '#fff' : t.textoSecundario, fontSize: 11 }}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Resultados — 2 columnas en web */}
          <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
            {semestresData.flatMap(s => s.materias).map(m => (
              <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
                <MCard m={m} />
              </View>
            ))}
          </View>
        </>
      )}
```

**Step 4: Verificar visual**

- Abrir Vista previa → Carrera → verificar que en web los tabs Carrera/Semestre muestran 2 columnas
- Verificar tab Búsqueda: search bar, chips de modo, indicador 📌 al seleccionar "Es previa de" / "Sus previas", 2 columnas en web

**Step 5: Commit**

```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "fix(preview): CarreraPreview - 2-col web grid and improved Búsqueda tab"
```

---

## Verificación final

1. Abrir Personalizar tema → pestaña Horarios → verificar stepper (mín 6, máx 20, restaurar)
2. Cambiar tamaño → ir a Horario → confirmar que el texto en bloques cambia
3. Cambiar colores de "Estado de materia" en Config → abrir Preview → Métricas → confirmar que los colores se reflejan
4. En web: abrir Preview → Carrera, Horarios, Métricas → confirmar layout 2 columnas donde corresponde
5. TypeScript sin errores: `npx tsc --noEmit`

## Commit final

```bash
git add -A
git commit -m "feat(config): horario font size stepper + preview fidelity fixes"
```
