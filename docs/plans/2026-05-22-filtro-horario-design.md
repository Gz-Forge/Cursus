# Diseño: Filtro en sección Horario de EditMateriaScreen

**Fecha:** 2026-05-22  
**Feature:** Filtros por tipo y por fecha en la lista de bloques de horario

---

## Contexto

La sección HORARIO en `EditMateriaScreen` muestra todos los `BloqueHorario` de una materia en un `ScrollView` de maxHeight 260. Cuando hay muchos bloques (cursos largos, importaciones ICS) la lista se vuelve difícil de navegar. Se agrega un sistema de filtros en dos filas de chips siempre visibles.

---

## Estado nuevo

```typescript
const [filtroTipos, setFiltroTipos] = useState<TipoBloque[]>([]);
const [filtroFecha, setFiltroFecha] = useState<'todos'|'futuros'|'semana'|'mes'|'rango'>('todos');
const [filtroDesde, setFiltroDesde] = useState('');   // DD/MM, solo activo si filtroFecha==='rango'
const [filtroHasta, setFiltroHasta] = useState('');
```

---

## Derivado: bloquesFiltrados

```typescript
const bloquesFiltrados = useMemo(() => {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);

  let lista = [...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Filtro por tipo
  if (filtroTipos.length > 0) {
    lista = lista.filter(b => filtroTipos.includes(b.tipo));
  }

  // Filtro por fecha
  if (filtroFecha === 'futuros') {
    lista = lista.filter(b => b.fecha >= hoyISO);
  } else if (filtroFecha === 'semana') {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const desdeISO = lunes.toISOString().slice(0, 10);
    const hastaISO = domingo.toISOString().slice(0, 10);
    lista = lista.filter(b => b.fecha >= desdeISO && b.fecha <= hastaISO);
  } else if (filtroFecha === 'mes') {
    const mesActual = hoyISO.slice(0, 7); // "YYYY-MM"
    lista = lista.filter(b => b.fecha.startsWith(mesActual));
  } else if (filtroFecha === 'rango') {
    const desde = parsearFecha(filtroDesde);
    const hasta = parsearFecha(filtroHasta);
    if (desde) lista = lista.filter(b => b.fecha >= desde);
    if (hasta) lista = lista.filter(b => b.fecha <= hasta);
  }

  return lista;
}, [form.bloques, filtroTipos, filtroFecha, filtroDesde, filtroHasta]);
```

---

## UI

### Encabezado
```
HORARIO  (3 de 12)
```
- El contador `(N de M)` aparece solo cuando hay algún filtro activo (`filtroTipos.length > 0 || filtroFecha !== 'todos'`)

### Fila 1 — Tipos (multi-select)
Chips: `[ Teórica ]  [ Práctica ]  [ Otro ]`
- Activo: fondo `tema.acento`, texto `#fff`
- Inactivo: fondo `tema.fondo`, texto `tema.textoSecundario`
- Toggle: si ya está en `filtroTipos`, se quita; si no, se agrega

### Fila 2 — Fecha (single-select)
Chips: `[ Todos ]  [ Futuros ]  [ Esta sem ]  [ Este mes ]  [ Rango ]`
- Solo uno activo a la vez
- Mismo estilo visual que fila 1

### Inputs de rango (condicional)
Visibles únicamente cuando `filtroFecha === 'rango'`:
- Dos `TextInput` compactos lado a lado: Desde / Hasta
- Formato `DD/MM`, autoformateado igual que los inputs de fecha del formulario de bloque
- Si un input está vacío, ese extremo del rango no se aplica

### Lista
Reemplaza `[...(form.bloques ?? [])].sort(...)` por `bloquesFiltrados` directamente.

---

## Archivo a modificar

- `TablaApp/src/screens/EditMateriaScreen.tsx`
  - Agregar 4 estados nuevos
  - Agregar `useMemo` para `bloquesFiltrados`
  - Reemplazar encabezado HORARIO con contador
  - Agregar UI de chips entre el título y el ScrollView
  - Reemplazar fuente de datos del ScrollView

---

## Lo que NO cambia

- El formulario de edición/creación de bloques: sin cambios
- La lógica de auto-save: sin cambios
- `form.bloques` sigue siendo la fuente de verdad; el filtro es solo visual
