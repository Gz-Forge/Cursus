# Plan A — Toggle de Cursando + Colores de Horario

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mover el toggle "Estoy cursando" al tope de EditMateria, añadirlo a la tarjeta extendida (sincronizado), agregar su visibilidad a TarjetaConfig, y crear la sección "Configuración de colores en Horario" en ConfigScreen con colores por materia/tipo de bloque aplicados en HorarioScreen.

**Architecture:** Cambios de UI puros + extensión del tipo `Config` con `coloresHorario` y `tarjetaMostrarToggleCursando`. Todo persiste a través de `actualizarConfig`. El color picker cross-platform usa hex input + preview box (sin dependencias nuevas); en web se puede usar `<input type="color">` vía `Platform.OS`.

**Tech Stack:** React Native, Expo, Zustand (`useStore`), TypeScript, `useTema` / `ThemeContext`.

---

## Task 1 — Mover toggle "Estoy cursando" al tope de EditMateriaScreen

**Archivos:**
- Modificar: `src/screens/EditMateriaScreen.tsx:400-517`

**Contexto:**
Actualmente el toggle vive en la sección "ESTADO" (línea 500-517), después de TIPO DE FORMACIÓN y PREVIAS NECESARIAS. Hay que moverlo para que sea lo primero que ve el usuario, antes de "INFORMACIÓN GENERAL", y eliminar el título "ESTADO".

**Cambio:**
Eliminar el bloque de líneas 500–517 completo (título `ESTADO` + tarjeta con Switch) y añadirlo **antes** del texto `INFORMACIÓN GENERAL` (línea 405). El bloque que hay que insertar es:

```tsx
{/* ── Toggle Cursando ── */}
<View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 16 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <View style={{ flex: 1 }}>
      <Text style={{ color: tema.texto, fontWeight: '600' }}>Estoy cursando esta materia</Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
        {form.cursando
          ? 'El estado se muestra como Cursando sin importar la nota'
          : 'El estado se calcula a partir de la nota'}
      </Text>
    </View>
    <Switch
      value={form.cursando ?? false}
      onValueChange={handleToggleCursando}
      trackColor={{ true: tema.acento }}
    />
  </View>
</View>
```

**Verificación:** Al abrir Editar cualquier materia, el toggle "Estoy cursando" aparece antes del nombre. Ya no existe el título "ESTADO".

**Commit:**
```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat: mover toggle cursando al tope de EditMateriaScreen"
```

---

## Task 2 — Toggle de cursando en tarjeta extendida (MateriaCard)

**Archivos:**
- Modificar: `src/components/MateriaCard.tsx`

**Contexto:**
`MateriaCard` recibe `materia`, `todasLasMaterias`, `config` y `onEditar`. No recibe `guardarMateria`. Hay que recibirlo también, o bien recibir un callback `onToggleCursando`.

El toggle en la tarjeta debe validar los mismos requisitos que `handleToggleCursando` en EditMateriaScreen (créditos + previas). La lógica de validación vive en `EditMateriaScreen` — hay que extraerla a una función utilitaria o duplicarla aquí de forma simplificada. Dado que Alert.alert es cross-platform, se puede inline en MateriaCard.

**Paso 1 — Añadir prop `onToggleCursando`:**

En la interfaz `Props` de `MateriaCard`:
```ts
interface Props {
  materia: Materia;
  todasLasMaterias: Materia[];
  config: Config;
  onEditar: () => void;
  onToggleCursando?: (v: boolean) => void;  // nuevo
  mostrarToggleCursando?: boolean;           // controlado por config
}
```

**Paso 2 — Añadir el toggle en la vista expandida:**

Reemplazar el botón Editar actual (línea 138-140):
```tsx
<TouchableOpacity style={s.botonEditar} onPress={onEditar}>
  <Text style={{ color: '#fff', fontSize: 13 }}>✏️ Editar</Text>
</TouchableOpacity>
```

Por una fila con toggle a la izquierda y botón Editar a la derecha:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
  {(mostrarToggleCursando ?? true) && onToggleCursando && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
      <Switch
        value={materia.cursando ?? false}
        onValueChange={onToggleCursando}
        trackColor={{ true: estadoColores.cursando }}
      />
      <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
        {materia.cursando ? 'Cursando' : 'No cursando'}
      </Text>
    </View>
  )}
  <TouchableOpacity style={s.botonEditar} onPress={onEditar}>
    <Text style={{ color: '#fff', fontSize: 13 }}>✏️ Editar</Text>
  </TouchableOpacity>
</View>
```

**Paso 3 — Pasar el prop desde CarreraScreen:**

Buscar dónde se renderiza `<MateriaCard>` (en `src/screens/CarreraScreen.tsx`) y añadir los props nuevos:

```tsx
<MateriaCard
  materia={m}
  todasLasMaterias={materias}
  config={config}
  onEditar={() => navigation.navigate('EditMateria', { materiaId: m.id })}
  mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
  onToggleCursando={(v) => {
    // Misma lógica de validación que handleToggleCursando en EditMateriaScreen
    // Si v === false: guardar directo
    // Si v === true: validar créditos y previas, luego guardar o mostrar Alert
    handleToggleCursandoCard(m, v);
  }}
/>
```

Implementar `handleToggleCursandoCard` en `CarreraScreen` (o donde se renderice el card) usando `guardarMateria` del store y la misma lógica de validación (créditos acumulados + previas aprobadas).

**Verificación:** Al expandir una tarjeta, aparece un Switch a la izquierda del botón Editar. Activarlo/desactivarlo persiste igual que hacerlo desde Editar materia.

**Commit:**
```bash
git add src/components/MateriaCard.tsx src/screens/CarreraScreen.tsx
git commit -m "feat: toggle cursando en tarjeta extendida, sincronizado con store"
```

---

## Task 3 — Opción en TarjetaConfig para mostrar/ocultar el toggle

**Archivos:**
- Modificar: `src/types/index.ts` (interfaz `Config`)
- Modificar: `src/store/useStore.ts` (`CONFIG_DEFAULT`)
- Modificar: `src/screens/TarjetaConfigScreen.tsx` (panel "extendida")

**Paso 1 — Añadir campo a Config (`src/types/index.ts`):**
```ts
// En la interfaz Config, después de tarjetaCreditosExtendida:
tarjetaMostrarToggleCursando: boolean;
```

**Paso 2 — Valor por defecto (`src/store/useStore.ts`):**
```ts
// En CONFIG_DEFAULT:
tarjetaMostrarToggleCursando: true,
```

**Paso 3 — UI en TarjetaConfigScreen (`src/screens/TarjetaConfigScreen.tsx`):**

En el bloque `{panel === 'extendida'}`, dentro del `<View>` de "OTROS CAMPOS" (al final, después de `tarjetaCreditosExtendida`), añadir:

```tsx
<ToggleFila
  label='Mostrar toggle "Estoy cursando"'
  valor={config.tarjetaMostrarToggleCursando ?? true}
  onChange={v => actualizarConfig({ tarjetaMostrarToggleCursando: v })}
  descripcion="Muestra un switch rápido en la tarjeta expandida para cambiar el estado de cursando"
/>
```

**Verificación:** En Configuración → Tarjetas de materia → Tarjeta expandida aparece la opción. Al desactivarla, el toggle desaparece de las tarjetas.

**Commit:**
```bash
git add src/types/index.ts src/store/useStore.ts src/screens/TarjetaConfigScreen.tsx
git commit -m "feat: opcion config para mostrar/ocultar toggle cursando en tarjeta"
```

---

## Task 4 — Tipo `coloresHorario` en Config

**Archivos:**
- Modificar: `src/types/index.ts`
- Modificar: `src/store/useStore.ts`

**Paso 1 — Añadir tipo auxiliar y campo a Config:**
```ts
// En src/types/index.ts, antes de la interfaz Config:
export interface ColorBloque {
  fondo: string;
  texto: string;
}

// En la interfaz Config:
coloresHorario: Record<string, Partial<Record<TipoBloque, ColorBloque>>>;
// Ejemplo: { "materiaId": { teorica: { fondo: '#4CAF50', texto: '#fff' } } }
```

**Paso 2 — Valor por defecto:**
```ts
// En CONFIG_DEFAULT:
coloresHorario: {},
```

**Verificación:** TypeScript compila sin errores. El store arranca con `coloresHorario: {}`.

**Commit:**
```bash
git add src/types/index.ts src/store/useStore.ts
git commit -m "feat: tipo ColorBloque y campo coloresHorario en Config"
```

---

## Task 5 — Sección "Configuración de colores en Horario" en ConfigScreen

**Archivos:**
- Modificar: `src/screens/ConfigScreen.tsx`

**Contexto:**
La sección se inserta entre "TIPOS DE BLOQUE DE HORARIO" y "IMPORTAR / EXPORTAR".
Solo muestra materias con estado `cursando` Y que tengan `bloques` con al menos 1 elemento.
Cada materia es un acordeón (como los prompts para IA). Al expandir, muestra los tipos de bloque que esa materia tiene en sus bloques (únicos), y por cada tipo dos inputs: color de fondo y color de texto.

**Color picker cross-platform:**
- En `Platform.OS === 'web'`: usar `<input type="color" />` vía un `TextInput` con `value` y `onChangeText` que acepta hex. O mejor: un `View` clickeable que abre `<input type="color">` nativo del browser.
- En móvil: `TextInput` que acepta hex `#RRGGBB` + un `View` de preview con ese color de fondo.

Para mantenerlo simple y sin dependencias externas, usar este patrón consistente en ambas plataformas:

```tsx
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isValidHex ? value : tema.borde, borderWidth: 1, borderColor: tema.borde }} />
      <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 60 }}>{label}</Text>
      <TextInput
        style={{ flex: 1, backgroundColor: tema.tarjeta, color: tema.texto, padding: 6, borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
        value={value}
        onChangeText={onChange}
        placeholder="#RRGGBB"
        placeholderTextColor={tema.textoSecundario}
        maxLength={7}
        autoCapitalize="characters"
      />
    </View>
  );
}
```

**Lógica de la sección en ConfigScreen:**

```tsx
// Calcular las materias cursando con horario (mover fuera del JSX para legibilidad):
const materiasConHorario = materias.filter(m =>
  calcularEstadoFinal(m, config) === 'cursando' &&
  (m.bloques ?? []).length > 0
);

// Estado local para acordeones (dentro del componente ConfigScreen):
const [acordeonesHorario, setAcordeonesHorario] = useState<Record<string, boolean>>({});
const toggleAcordeon = (id: string) => setAcordeonesHorario(p => ({ ...p, [id]: !p[id] }));
```

**Sección JSX a insertar (antes de IMPORTAR / EXPORTAR, línea 257):**

```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>
  CONFIGURACIÓN DE COLORES EN HORARIO
</Text>

{materiasConHorario.length === 0 ? (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
      No hay materias en estado "Cursando" con horarios definidos.
    </Text>
  </View>
) : (
  <View style={{ marginBottom: 20 }}>
    {materiasConHorario.map(m => {
      // Tipos de bloque únicos que tiene esta materia
      const tiposPresentes = [...new Set((m.bloques ?? []).map(b => b.tipo))] as TipoBloque[];
      const coloresMateria = config.coloresHorario?.[m.id] ?? {};
      const expandida = !!acordeonesHorario[m.id];

      return (
        <View key={m.id} style={{ marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => toggleAcordeon(m.id)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: expandida ? undefined : 10,
              borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 14 }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600', flex: 1 }}>{m.nombre}</Text>
            <Text style={{ color: tema.acento }}>{expandida ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {expandida && (
            <View style={{ backgroundColor: tema.tarjeta, borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
              padding: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: tema.borde }}>
              {tiposPresentes.map(tipo => {
                const label = (() => {
                  switch (tipo) {
                    case 'teorica': return config.labelTeorica || 'Teórica';
                    case 'practica': return config.labelPractica || 'Práctica';
                    case 'parcial': return config.labelParcial || 'Parcial';
                    case 'otro': return config.labelOtro || 'Otro';
                  }
                })();
                const colorActual = coloresMateria[tipo] ?? { fondo: '#4CAF50', texto: '#ffffff' };

                const actualizarColor = (campo: 'fondo' | 'texto', valor: string) => {
                  actualizarConfig({
                    coloresHorario: {
                      ...config.coloresHorario,
                      [m.id]: {
                        ...coloresMateria,
                        [tipo]: { ...colorActual, [campo]: valor },
                      },
                    },
                  });
                };

                return (
                  <View key={tipo} style={{ marginBottom: 12 }}>
                    {/* Preview del bloque */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={{ backgroundColor: colorActual.fondo, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: colorActual.texto, fontSize: 12, fontWeight: '700' }}>{label}</Text>
                      </View>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Vista previa</Text>
                    </View>
                    <ColorInput
                      label="Fondo"
                      value={colorActual.fondo}
                      onChange={v => actualizarColor('fondo', v)}
                    />
                    <ColorInput
                      label="Texto"
                      value={colorActual.texto}
                      onChange={v => actualizarColor('texto', v)}
                    />
                  </View>
                );
              })}
              {/* Botón reset */}
              <TouchableOpacity
                onPress={() => {
                  const nuevo = { ...config.coloresHorario };
                  delete nuevo[m.id];
                  actualizarConfig({ coloresHorario: nuevo });
                }}
                style={{ alignItems: 'center', paddingVertical: 6 }}
              >
                <Text style={{ color: '#F44336', fontSize: 12 }}>Resetear colores de esta materia</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    })}
  </View>
)}
```

Agregar los imports necesarios:
- `calcularEstadoFinal` desde `'../utils/calculos'`
- `TipoBloque` desde `'../types'`
- `materias` desde el store: `const { config, actualizarConfig, materias } = useStore();`

**Verificación:** En Configuración aparece la nueva sección. Las materias cursando con horario aparecen como acordeones. Al expandir, se ven los tipos de bloque con inputs de color y vista previa.

**Commit:**
```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: seccion configuracion de colores en horario en ConfigScreen"
```

---

## Task 6 — Aplicar colores configurados en HorarioScreen

**Archivos:**
- Modificar: `src/screens/HorarioScreen.tsx`

**Contexto:**
Actualmente `colorMateria(num)` devuelve un color del array `COLORES_BLOQUES`. El color de texto siempre es `#fff`. Hay que reemplazar esa lógica por una función que priorice `config.coloresHorario[materiaId][tipo]`, cayendo al color estático si no hay configuración.

**Paso 1 — Reemplazar función `colorMateria` por `obtenerColorBloque`:**

```ts
// Reemplazar la función colorMateria (línea 153) y el texto hardcodeado '#fff':
const obtenerColorBloque = (materiaId: string, tipo: BloqueHorario['tipo']): { fondo: string; texto: string } => {
  const configurado = config.coloresHorario?.[materiaId]?.[tipo];
  if (configurado) return configurado;
  // Fallback: usar número de materia para elegir color del array
  const materia = materias.find(m => m.id === materiaId);
  const fondo = COLORES_BLOQUES[(materia?.numero ?? 0) % COLORES_BLOQUES.length];
  return { fondo, texto: '#ffffff' };
};
```

**Paso 2 — Aplicar en el render de bloques** (línea 334-350):

```tsx
{bloquesEstaSemana
  .filter(b => b.fecha === fecha)
  .map(b => {
    const top    = (b.horaInicio - horaInicio) * PX_POR_MIN;
    const height = Math.max((b.horaFin - b.horaInicio) * PX_POR_MIN, 16);
    const { fondo, texto } = obtenerColorBloque(b.materia.id, b.tipo);  // CAMBIADO
    return (
      <View key={b.id} style={{
        position: 'absolute', top, height,
        left: 1, right: 1,
        backgroundColor: fondo, borderRadius: 3,            // CAMBIADO: color → fondo
        padding: 2, overflow: 'hidden',
      }}>
        <Text
          style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}  // CAMBIADO: '#fff' → texto
          numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
          ellipsizeMode="tail"
        >
          {sigla(b.tipo)} - {b.materia.nombre}
        </Text>
      </View>
    );
  })}
```

**Verificación:** En Horario, los bloques de materias con colores configurados muestran esos colores. Los sin configurar siguen usando el array `COLORES_BLOQUES`.

**Commit:**
```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat: aplicar colores configurados por materia/tipo en HorarioScreen"
```

---

## Resumen de archivos tocados

| Archivo | Cambio |
|---------|--------|
| `src/screens/EditMateriaScreen.tsx` | Toggle cursando al tope, eliminar sección ESTADO |
| `src/components/MateriaCard.tsx` | Toggle + botón Editar en fila, nueva prop `onToggleCursando` |
| `src/screens/CarreraScreen.tsx` | Pasar `onToggleCursando` y `mostrarToggleCursando` a MateriaCard |
| `src/types/index.ts` | `ColorBloque`, `tarjetaMostrarToggleCursando`, `coloresHorario` en Config |
| `src/store/useStore.ts` | Defaults para los 2 campos nuevos |
| `src/screens/TarjetaConfigScreen.tsx` | ToggleFila para `tarjetaMostrarToggleCursando` |
| `src/screens/ConfigScreen.tsx` | Sección colores horario con `ColorInput` y acordeones |
| `src/screens/HorarioScreen.tsx` | `obtenerColorBloque` reemplaza `colorMateria` |
