# Horario — Botón Datos + Filtro de Bloques: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fusionar los botones Importar/Exportar en uno solo ("Datos") y agregar un botón de filtro que controla qué tipos de bloques se muestran en la grilla del horario, persistido entre sesiones.

**Architecture:** Se agregan 2 campos a `Config` para persistencia del filtro, se añade 1 estado local para el modal de datos, se reemplaza el par de botones en ambas variantes de layout, y se agregan 2 modales nuevos (Datos y Filtro). El filtrado se aplica en los `useMemo` existentes de `bloquesEstaSemana` y en `evaluacionesEstaSemana`.

**Tech Stack:** React Native, TypeScript, Zustand (`useStore` + `actualizarConfig`).

---

## Task 1: Agregar campos al tipo `Config`

**Files:**
- Modify: `src/types/index.ts:172`

**Step 1: Insertar los dos campos nuevos en `Config` después de `horarioPrimerDia`**

Ubicar la línea:
```typescript
  horarioPrimerDia: 'lunes' | 'domingo';
```

Reemplazarla con:
```typescript
  horarioPrimerDia: 'lunes' | 'domingo';
  horarioFiltroOcultos: TipoBloque[];        // [] = mostrar todo
  horarioFiltroOcultarEvaluaciones: boolean; // false = mostrar evaluaciones
```

**Step 2: Verificar que no haya errores de TypeScript**

Correr en `TablaApp/`:
```bash
npx tsc --noEmit
```
Esperado: 0 errores (o solo los ya existentes antes del cambio).

**Step 3: Commit**

```bash
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add src/types/index.ts
git commit -m "feat(types): add horarioFiltroOcultos and horarioFiltroOcultarEvaluaciones to Config"
```

---

## Task 2: Agregar defaults en el store

**Files:**
- Modify: `src/store/useStore.ts:50-51`

**Step 1: Insertar defaults en `CONFIG_DEFAULT` después de `horarioPrimerDia`**

Ubicar:
```typescript
  horarioMostrarEvaluaciones: true,
  horarioPrimerDia: 'lunes',
```

Reemplazar con:
```typescript
  horarioMostrarEvaluaciones: true,
  horarioPrimerDia: 'lunes',
  horarioFiltroOcultos: [],
  horarioFiltroOcultarEvaluaciones: false,
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: 0 errores nuevos.

**Step 3: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat(store): add defaults for horarioFiltroOcultos and horarioFiltroOcultarEvaluaciones"
```

---

## Task 3: Aplicar filtro en los datos de la grilla

**Files:**
- Modify: `src/screens/HorarioScreen.tsx:222-231`

**Step 1: Modificar `bloquesEstaSemana` para respetar el filtro de tipos**

Ubicar el useMemo existente (línea ~222):
```typescript
  const bloquesEstaSemana = React.useMemo(
    () => todosLosBloques.filter(b => b.fecha >= fechasSemana[0] && b.fecha <= fechasSemana[6]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todosLosBloques.map(b => `${b.id}:${b.fecha}:${b.horaInicio}:${b.horaFin}`).join('|'), fechasSemana[0], fechasSemana[6]]
  );
```

Reemplazar con:
```typescript
  const bloquesEstaSemana = React.useMemo(
    () => todosLosBloques.filter(b =>
      b.fecha >= fechasSemana[0] && b.fecha <= fechasSemana[6] &&
      !(config.horarioFiltroOcultos ?? []).includes(b.tipo)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todosLosBloques.map(b => `${b.id}:${b.fecha}:${b.horaInicio}:${b.horaFin}`).join('|'), fechasSemana[0], fechasSemana[6], (config.horarioFiltroOcultos ?? []).join(',')]
  );
```

**Step 2: Modificar `evaluacionesEstaSemana` para respetar el filtro de evaluaciones**

Ubicar (línea ~229):
```typescript
  const evaluacionesEstaSemana = todasLasEvaluaciones.filter(
    ev => ev.fecha! >= fechasSemana[0] && ev.fecha! <= fechasSemana[6]
  );
```

Reemplazar con:
```typescript
  const evaluacionesEstaSemana = config.horarioFiltroOcultarEvaluaciones
    ? []
    : todasLasEvaluaciones.filter(
        ev => ev.fecha! >= fechasSemana[0] && ev.fecha! <= fechasSemana[6]
      );
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): apply filtroOcultos and filtroOcultarEvaluaciones to grid data"
```

---

## Task 4: Nuevo estado local y cálculo de tipos presentes

**Files:**
- Modify: `src/screens/HorarioScreen.tsx:75-77`

**Step 1: Agregar estado `modalDatos` y `modalFiltro`**

Ubicar el bloque de estados existentes (línea ~75):
```typescript
  const [modalExport, setModalExport] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
```

Agregar `modalDatos` y `modalFiltro` después de esa línea:
```typescript
  const [modalExport, setModalExport] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [modalDatos, setModalDatos] = useState(false);
  const [modalFiltro, setModalFiltro] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
```

**Step 2: Agregar `actualizarConfig` al destructuring del store**

Ubicar (línea ~71):
```typescript
  const { materias, config } = useStore();
```

Reemplazar con:
```typescript
  const { materias, config, actualizarConfig } = useStore();
```

**Step 3: Agregar derivación de tipos presentes en el horario**

Ubicar la línea (después de `todosLosBloques`, ~línea 181):
```typescript
  const todosLosBloques = materiasEnCurso
    .flatMap(m => (m.bloques ?? []).map(b => ({ ...b, materia: m })));
```

Justo después, agregar:
```typescript
  // Tipos de bloque que realmente existen en las materias cursando (para el modal de filtro)
  const tiposPresentes = (['teorica', 'practica', 'parcial', 'otro'] as const)
    .filter(tipo => todosLosBloques.some(b => b.tipo === tipo));

  const labelDeTipo = (tipo: TipoBloque): string => {
    switch (tipo) {
      case 'teorica':  return config.labelTeorica  || 'Teórica';
      case 'practica': return config.labelPractica || 'Práctica';
      case 'parcial':  return config.labelParcial  || 'Parcial';
      case 'otro':     return config.labelOtro     || 'Otro';
    }
  };

  const filtroActivo =
    (config.horarioFiltroOcultos ?? []).length > 0 ||
    config.horarioFiltroOcultarEvaluaciones;
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): add modalDatos/modalFiltro state, tiposPresentes derivation"
```

---

## Task 5: Reemplazar botones en ambas variantes de layout

**Files:**
- Modify: `src/screens/HorarioScreen.tsx:379-433`

### Layout web/ancho (línea ~379-395)

**Step 1: Reemplazar el `View` con los dos botones Importar/Exportar**

Ubicar:
```typescript
            {/* Derecha: botones importar/exportar (tamaño fijo, pegados a la derecha) */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalImport(true)}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📥</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Importar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📤</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Exportar</Text>
              </TouchableOpacity>
            </View>
```

Reemplazar con:
```typescript
            {/* Derecha: botones Datos y Filtrar */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalDatos(true)}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📦</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Datos</Text>
              </TouchableOpacity>
              <View>
                <TouchableOpacity
                  onPress={() => setModalFiltro(true)}
                  style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1,
                    borderColor: filtroActivo ? tema.acento : tema.borde,
                    paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🔽</Text>
                  <Text style={{ color: filtroActivo ? tema.acento : tema.textoSecundario, fontSize: 13, fontWeight: '600' }}>Filtrar</Text>
                </TouchableOpacity>
                {filtroActivo && (
                  <View style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10,
                    borderRadius: 5, backgroundColor: tema.acento }} />
                )}
              </View>
            </View>
```

### Layout móvil/compacto (línea ~416-433)

**Step 2: Reemplazar el `View` con los dos botones en móvil**

Ubicar:
```typescript
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setModalImport(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📥</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Importar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📤</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Exportar</Text>
              </TouchableOpacity>
            </View>
```

Reemplazar con:
```typescript
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setModalDatos(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📦</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Datos</Text>
              </TouchableOpacity>
              <View>
                <TouchableOpacity
                  onPress={() => setModalFiltro(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: filtroActivo ? tema.acento : tema.borde, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15 }}>🔽</Text>
                  <Text style={{ color: filtroActivo ? tema.acento : tema.textoSecundario, fontSize: 9, fontWeight: '600' }}>Filtrar</Text>
                </TouchableOpacity>
                {filtroActivo && (
                  <View style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8,
                    borderRadius: 4, backgroundColor: tema.acento }} />
                )}
              </View>
            </View>
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): replace Importar/Exportar buttons with Datos and Filtrar"
```

---

## Task 6: Agregar Modal Datos (Import/Export unificado)

**Files:**
- Modify: `src/screens/HorarioScreen.tsx` — justo antes de `{/* Modal importar */}` (~línea 872)

**Step 1: Insertar el modal Datos antes del modal importar existente**

Ubicar el comentario:
```typescript
      {/* Modal importar */}
```

Insertar **antes** de ese comentario:
```typescript
      {/* Modal Datos — punto de entrada unificado para Importar/Exportar */}
      <Modal visible={modalDatos} transparent animationType="fade" onRequestClose={() => setModalDatos(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 400 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 16 }}>
              Datos de horario
            </Text>
            <TouchableOpacity
              onPress={() => { setModalDatos(false); setModalImport(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
                backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 22 }}>📥</Text>
              <View>
                <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Importar</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Cargar horarios desde un archivo JSON</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setModalDatos(false); setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
                backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 22 }}>📤</Text>
              <View>
                <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Exportar</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Compartir horarios como archivo JSON</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalDatos(false)}
              style={{ padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): add modalDatos for unified Import/Export entry point"
```

---

## Task 7: Agregar Modal Filtro

**Files:**
- Modify: `src/screens/HorarioScreen.tsx` — justo después del modal importar (línea ~903, antes del cierre `</View>` del `innerContent`)

**Step 1: Insertar el modal Filtro después del `</Modal>` del modal importar**

Ubicar el cierre del modal importar:
```typescript
      </Modal>
    </View>
  );
```
(Ese `</View>` cierra el `innerContent`.)

Insertar el modal de filtro entre el `</Modal>` y el `</View>`:
```typescript
      {/* Modal Filtro de bloques */}
      <Modal visible={modalFiltro} transparent animationType="fade" onRequestClose={() => setModalFiltro(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 400 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              Mostrar en horario
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>
              Solo aparecen los tipos que tenés cargados
            </Text>

            {tiposPresentes.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                No hay bloques cargados en ninguna materia cursando.
              </Text>
            )}

            {tiposPresentes.map(tipo => {
              const oculto = (config.horarioFiltroOcultos ?? []).includes(tipo);
              return (
                <TouchableOpacity
                  key={tipo}
                  onPress={() => {
                    const actuales = config.horarioFiltroOcultos ?? [];
                    actualizarConfig({
                      horarioFiltroOcultos: oculto
                        ? actuales.filter(t => t !== tipo)
                        : [...actuales, tipo],
                    });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: tema.borde, gap: 12 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                    backgroundColor: !oculto ? tema.acento : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!oculto && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ color: tema.texto, fontSize: 14 }}>{labelDeTipo(tipo)}</Text>
                </TouchableOpacity>
              );
            })}

            {config.horarioMostrarEvaluaciones && todasLasEvaluaciones.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: tema.borde, marginVertical: 8 }} />
                <TouchableOpacity
                  onPress={() => actualizarConfig({ horarioFiltroOcultarEvaluaciones: !config.horarioFiltroOcultarEvaluaciones })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                    backgroundColor: !config.horarioFiltroOcultarEvaluaciones ? tema.acento : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!config.horarioFiltroOcultarEvaluaciones && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ color: tema.texto, fontSize: 14 }}>Evaluaciones</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => setModalFiltro(false)}
              style={{ marginTop: 16, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): add modalFiltro for real-time block type filtering"
```

---

## Checklist final

- [ ] Task 1: `Config` tiene `horarioFiltroOcultos` y `horarioFiltroOcultarEvaluaciones`
- [ ] Task 2: `CONFIG_DEFAULT` tiene ambos defaults
- [ ] Task 3: `bloquesEstaSemana` y `evaluacionesEstaSemana` respetan el filtro
- [ ] Task 4: estados `modalDatos`, `modalFiltro`, `actualizarConfig`, `tiposPresentes`, `labelDeTipo`, `filtroActivo` presentes
- [ ] Task 5: Botones Importar/Exportar reemplazados en ambas variantes de layout
- [ ] Task 6: Modal Datos funciona y abre el modal correcto
- [ ] Task 7: Modal Filtro muestra opciones dinámicas, persiste cambios via `actualizarConfig`
