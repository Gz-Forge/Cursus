# Design: Horario — Botón Datos unificado + Filtro de bloques

**Fecha:** 2026-05-07  
**Archivo principal:** `src/screens/HorarioScreen.tsx`  
**Tipos:** `src/types/index.ts`  
**Store:** `src/store/useStore.ts`

---

## Contexto

La pantalla HorarioScreen tiene dos botones separados (Importar / Exportar) y no ofrece forma de filtrar qué tipos de bloques se muestran en la grilla.

---

## Cambio 1: Botón "Datos" (fusión Import/Export)

### Comportamiento
Reemplazar los dos botones Importar y Exportar por un único botón **"📦 Datos"** que abre un `modalDatos`.

`modalDatos` muestra dos opciones:
- **📥 Importar** → cierra `modalDatos`, abre `modalImport` (existente, sin cambios)
- **📤 Exportar** → cierra `modalDatos`, abre `modalExport` (existente, sin cambios)
- **Cancelar** → cierra `modalDatos`

Los modales existentes de importar y exportar quedan intactos; solo cambia el punto de entrada.

### Estado nuevo
```typescript
const [modalDatos, setModalDatos] = useState(false);
```

### Layout
Aplica en ambas variantes (web ancho y móvil compacto). El botón "Datos" ocupa el lugar donde estaban los dos botones. Se agrega también el botón "Filtrar" al mismo `View`.

---

## Cambio 2: Filtro de bloques (persistente entre sesiones)

### Almacenamiento en Config
Dos campos nuevos en `Config`:

```typescript
horarioFiltroOcultos: TipoBloque[];        // [] = mostrar todo (default)
horarioFiltroOcultarEvaluaciones: boolean; // false = mostrar evaluaciones (default)
```

Defaults en `CONFIG_DEFAULT`:
```typescript
horarioFiltroOcultos: [],
horarioFiltroOcultarEvaluaciones: false,
```

Se persiste via `actualizarConfig(parcial)` existente.

### Botón "Filtrar"
Ícono de embudo (🔽 o similar) junto al botón "Datos" en ambas variantes de layout.  
Si `horarioFiltroOcultos.length > 0` o `horarioFiltroOcultarEvaluaciones === true`, mostrar un badge/punto de color acento sobre el botón como indicador de filtro activo.

### Modal de filtro
Al abrir, calcula dinámicamente los tipos presentes:

```typescript
const tiposPresentes = ['teorica', 'practica', 'parcial', 'otro']
  .filter(tipo => todosLosBloques.some(b => b.tipo === tipo)) as TipoBloque[];
```

Muestra un checkbox por cada tipo presente, usando el label del config del usuario (`config.labelTeorica`, etc.).  
Si `config.horarioMostrarEvaluaciones === true` y hay evaluaciones en las materias cursando, agrega opción "Evaluaciones".

El toggle de cada opción llama a `actualizarConfig` inmediatamente (sin botón Aplicar separado — el filtro es en tiempo real).

### Aplicación del filtro en la grilla
Modificar los useMemo existentes:

```typescript
// bloquesEstaSemana — agregar filtro de tipo
.filter(b => !config.horarioFiltroOcultos.includes(b.tipo))

// evaluacionesEstaSemana — condición adicional
config.horarioFiltroOcultarEvaluaciones ? [] : todasLasEvaluaciones.filter(...)
```

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | +2 campos en `Config` |
| `src/store/useStore.ts` | +2 defaults en `CONFIG_DEFAULT` |
| `src/screens/HorarioScreen.tsx` | +estado `modalDatos`, botones refactorizados, modal Datos, modal Filtro, filtrado de bloques |
