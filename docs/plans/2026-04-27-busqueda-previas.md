# Búsqueda por nombre/número + relaciones de previas — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar barra de búsqueda en el panel "Búsqueda" de CarreraScreen que filtra por nombre/número y permite explorar relaciones directas de previas en dos direcciones.

**Architecture:** Todo el cambio está en `CarreraScreen.tsx`. Se agregan dos estados (`textoBusqueda`, `modoBusqueda`), se añade `TextInput` al import de react-native, y se reemplaza el bloque `vista === 'busqueda'` para mostrar la barra siempre y los resultados condicionales cuando hay texto.

**Tech Stack:** React Native, TypeScript, Zustand (lectura del store ya existente)

---

## Task 1: Agregar estado y TextInput al import

**Files:**
- Modify: `src/screens/CarreraScreen.tsx:2` (import)
- Modify: `src/screens/CarreraScreen.tsx:39-42` (estados)

### Step 1: Agregar `TextInput` al import de react-native

Línea 2 actual:
```typescript
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, useWindowDimensions } from 'react-native';
```

Reemplazar por:
```typescript
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, useWindowDimensions, TextInput } from 'react-native';
```

### Step 2: Agregar los dos estados nuevos

Después de la línea `const [subFiltroDisp, ...] = useState(...)` (línea 42), agregar:

```typescript
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'nombre' | 'es_previa_de' | 'sus_previas'>('nombre');
```

### Step 3: Verificar compilación

```bash
cd C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp && npx tsc --noEmit 2>&1 | grep -v "perfiles.ts" | head -20
```
Expected: sin errores.

### Step 4: Commit

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat: add textoBusqueda and modoBusqueda state for previas search"
```

---

## Task 2: Reemplazar el bloque `vista === 'busqueda'` con la nueva UI

**Files:**
- Modify: `src/screens/CarreraScreen.tsx:352-504`

### Step 1: Leer el bloque actual

El bloque a reemplazar comienza en línea 352 y termina en línea 504:
```tsx
        {/* VISTA BÚSQUEDA */}
        {vista === 'busqueda' && (
          <>
            ...contenido actual...
          </>
        )}
```

### Step 2: Reemplazar el bloque completo

Reemplazar **todo** el bloque `{/* VISTA BÚSQUEDA */}` (desde el comentario hasta el `)}` de cierre, inclusive) por:

```tsx
        {/* VISTA BÚSQUEDA */}
        {vista === 'busqueda' && (
          <>
            {/* Barra de búsqueda */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>🔍</Text>
              <TextInput
                style={{ flex: 1, color: tema.texto, fontSize: 14 }}
                placeholder="Buscar por nombre o número..."
                placeholderTextColor={tema.textoSecundario}
                value={textoBusqueda}
                onChangeText={v => {
                  setTextoBusqueda(v);
                  if (!v) setModoBusqueda('nombre');
                }}
                autoCorrect={false}
              />
              {textoBusqueda.length > 0 && (
                <TouchableOpacity onPress={() => { setTextoBusqueda(''); setModoBusqueda('nombre'); }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 18, lineHeight: 20 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {textoBusqueda.length > 0 ? (
              /* ── Modo búsqueda activo ── */
              (() => {
                const q = textoBusqueda.trim().toLowerCase();
                const matchBusqueda = (m: typeof materias[0]) =>
                  m.nombre.toLowerCase().includes(q) || String(m.numero).includes(q);

                const modos = [
                  { key: 'nombre',       label: 'Nombre'      },
                  { key: 'es_previa_de', label: 'Es previa de' },
                  { key: 'sus_previas',  label: 'Sus previas'  },
                ] as const;

                let resultados: typeof materias = [];
                let emptyMsg = '';

                if (modoBusqueda === 'nombre') {
                  resultados = materias.filter(m => matchBusqueda(m));
                  emptyMsg = 'No se encontró ninguna materia con ese nombre o número';
                } else if (modoBusqueda === 'es_previa_de') {
                  const nums = new Set(materias.filter(m => matchBusqueda(m)).map(m => m.numero));
                  resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
                  emptyMsg = 'Esta materia no es requisito directo de ninguna otra';
                } else {
                  const nums = new Set(
                    materias.filter(m => matchBusqueda(m)).flatMap(m => m.previasNecesarias)
                  );
                  resultados = materias.filter(m => nums.has(m.numero));
                  emptyMsg = 'Esta materia no tiene previas requeridas';
                }

                return (
                  <>
                    {/* Chips de modo */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      {modos.map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setModoBusqueda(key)}
                          style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center',
                            backgroundColor: modoBusqueda === key ? tema.acento : tema.tarjeta }}
                        >
                          <Text style={{ color: modoBusqueda === key ? '#fff' : tema.textoSecundario, fontSize: 11, fontWeight: '600' }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {resultados.length === 0 ? (
                      <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                        {emptyMsg}
                      </Text>
                    ) : (
                      renderMateriasList(resultados)
                    )}
                  </>
                );
              })()
            ) : (
              /* ── Panel original cuando no hay búsqueda ── */
              <>
                {/* Toggle: Todas / Solo disponibles */}
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Mostrar</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setMostrarSoloDisponibles(false)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                      backgroundColor: !mostrarSoloDisponibles ? tema.acento : tema.tarjeta }}
                  >
                    <Text style={{ color: !mostrarSoloDisponibles ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMostrarSoloDisponibles(true)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                      backgroundColor: mostrarSoloDisponibles ? tema.acento : tema.tarjeta }}
                  >
                    <Text style={{ color: mostrarSoloDisponibles ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Disponibles</Text>
                  </TouchableOpacity>
                </View>

                {mostrarSoloDisponibles ? (
                  /* ── Vista: disponibles con sub-tabs ── */
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      {([
                        { key: 'para_cursar', label: '📚 Para cursar' },
                        { key: 'para_examen', label: '📝 Para dar examen' },
                      ] as const).map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setSubFiltroDisp(key)}
                          style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center',
                            backgroundColor: subFiltroDisp === key ? tema.acento : tema.tarjeta }}
                        >
                          <Text style={{ color: subFiltroDisp === key ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600' }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {subFiltroDisp === 'para_cursar' && (() => {
                      const numerosDisp = new Set(materiasDisponibles(materias, config));
                      const lista = materias.filter(m => numerosDisp.has(m.numero));
                      const primerSem = lista.filter(m => m.semestre % 2 === 1);
                      const segundoSem = lista.filter(m => m.semestre % 2 === 0);
                      return (
                        <>
                          {lista.length === 0 && (
                            <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24 }}>
                              No hay materias disponibles para cursar
                            </Text>
                          )}
                          {primerSem.length > 0 && (
                            <>
                              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                                1° semestre del año
                              </Text>
                              {renderMateriasList(primerSem)}
                            </>
                          )}
                          {segundoSem.length > 0 && (
                            <>
                              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 13,
                                marginBottom: 8, marginTop: primerSem.length > 0 ? 12 : 0 }}>
                                2° semestre del año
                              </Text>
                              {renderMateriasList(segundoSem)}
                            </>
                          )}
                        </>
                      );
                    })()}

                    {subFiltroDisp === 'para_examen' && (() => {
                      const paraExamen = materias.filter(m => calcularEstadoFinal(m, config) === 'reprobado');
                      return (
                        <>
                          {paraExamen.length === 0 ? (
                            <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24 }}>
                              No tenés materias pendientes de examen
                            </Text>
                          ) : (
                            <>
                              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                                {paraExamen.length} materia{paraExamen.length !== 1 ? 's' : ''} pendiente{paraExamen.length !== 1 ? 's' : ''} de examen
                              </Text>
                              {renderMateriasList(paraExamen)}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  /* ── Vista: todas con filtros de estado y tipo ── */
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Estado</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={() => setFiltroEstado(null)}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroEstado === null ? tema.acento : tema.tarjeta }}
                      >
                        <Text style={{ color: filtroEstado === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todos</Text>
                      </TouchableOpacity>
                      {(Object.keys(ESTADO_LABELS) as EstadoMateria[]).map(e => (
                        <TouchableOpacity
                          key={e}
                          onPress={() => setFiltroEstado(prev => prev === e ? null : e)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroEstado === e ? estadoColores[e] : tema.tarjeta }}
                        >
                          <Text style={{ color: filtroEstado === e ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{ESTADO_LABELS[e]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {tiposFormacion.length > 0 && (
                      <>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Tipo de formación</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          <TouchableOpacity
                            onPress={() => setFiltroTipo(null)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroTipo === null ? tema.acento : tema.tarjeta }}
                          >
                            <Text style={{ color: filtroTipo === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todos</Text>
                          </TouchableOpacity>
                          {tiposFormacion.map(t => (
                            <TouchableOpacity
                              key={t}
                              onPress={() => setFiltroTipo(prev => prev === t ? null : t)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroTipo === t ? tema.acento : tema.tarjeta }}
                            >
                              <Text style={{ color: filtroTipo === t ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    {renderMateriasList(
                      materias.filter(m => {
                        const estadoOk = filtroEstado === null || calcularEstadoFinal(m, config) === filtroEstado;
                        const tipoOk = filtroTipo === null || m.tipoFormacion === filtroTipo;
                        return estadoOk && tipoOk;
                      })
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
```

### Step 3: Verificar compilación

```bash
cd C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp && npx tsc --noEmit 2>&1 | grep -v "perfiles.ts" | head -30
```
Expected: sin errores.

### Step 4: Verificar lógica mental

| Escenario | Resultado esperado |
|---|---|
| Sin texto | Panel original: Todas/Disponibles visible |
| Texto "calc", modo Nombre | Materias cuyo nombre contiene "calc" o número contiene "calc" |
| Texto "1", modo Nombre | Materias cuyo nombre contiene "1" o número es "1", "10", "11"... |
| Texto "calc", modo "Es previa de" | Materias que tienen a Cálculo en su `previasNecesarias` |
| Texto "calc", modo "Sus previas" | Materias que son `previasNecesarias` de Cálculo |
| Texto "calc", modo "Sus previas", sin previas | Mensaje "Esta materia no tiene previas requeridas" |
| Limpiar con ✕ | Vuelve al panel original, modo reseteado a 'nombre' |

### Step 5: Commit

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat: add name/number search with previas relationship explorer in Búsqueda panel"
```

---

## Checklist de verificación manual

1. Tab Búsqueda → barra de búsqueda visible arriba
2. Sin texto → panel Todas/Disponibles funciona igual que antes
3. Escribir nombre parcial → modo Nombre filtra correctamente
4. Escribir número → filtra por número
5. Cambiar a "Es previa de" → muestra materias que requieren la buscada
6. Cambiar a "Sus previas" → muestra las previas requeridas por la buscada
7. Materia sin previas → mensaje vacío apropiado
8. Botón ✕ → limpia texto y vuelve al panel original
