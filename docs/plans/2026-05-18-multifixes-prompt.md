# Prompt — Multi-fix 2026-05-18

## Pantalla Carrera — panel Búsqueda (móvil)
- Botones "Todas", "Para cursar", "Para dar examen": textos centrados verticalmente (sin espacio vacío abajo).
- Usar `justifyContent: 'center'` o `textAlignVertical: 'center'` para que botones con texto corto no queden con espacio en blanco inferior.

## Pantalla Configuración — panel Notas
- Al eliminar un Tipo de formación que esté siendo usado por materias:
  - Mostrar alerta de confirmación con el número de materias que lo usan.
  - Si se confirma: vaciar el campo tipoFormacion en esas materias.

## Editar Materia — fecha y horario de evaluaciones
- Actualizar el selector de fecha/hora de evaluaciones para usar el mismo componente/método que "añadir nuevo bloque horario".

## Pantalla Horario — evaluaciones grupales y drag-and-drop
- Bug: los bloques horarios de evaluaciones grupales no aparecen en el horario.
- Bug: las tarjetas de evaluaciones no tienen drag-and-drop habilitado.
- Bug: si se coloca un bloque horario sobre un bloque de evaluación, la evaluación queda oculta (z-index).

## Pantalla Métricas — configuración de orden y configuración de "Notas obtenidas"
- En el panel de configuración (habilitar/deshabilitar métricas):
  - Añadir drag-and-drop para reordenar métricas (mantener clic en título + arrastrar arriba/abajo).
  - El orden en la configuración debe reflejar el orden en pantalla.
- Para la métrica "Notas obtenidas":
  - Añadir opción de redondeo: hacia abajo / hacia arriba.
  - Añadir opción de clasificar en rangos (p.ej. <7, 7-8, >8) — solo se crean rangos donde hay notas.

## Pantalla Configuración — panel Datos / Importar
- Quitar los apartados "Configuración desde json" y "Colores de horario" como opciones separadas de importación.
- Esas importaciones deben quedar absorbidas por "Desde archivo json" (un solo flujo).

## Pantalla Configuración — panel Datos / Exportar
- Quitar el apartado "Configuración" (solo el export .json; mantener el compartir QR).
- Quitar el apartado "Colores de horario" como exportación separada.
- Crear prompt de IA para "Colores de horario":
  - Al copiar, incluir el JSON de materias que tengan "Configuración de colores en horario".
  - El prompt le dice a la IA cómo están configuradas actualmente las materias y les pregunta con qué colores quisieran configurar cada materia y opción.
- Añadir al JSON de colores de horario la configuración de colores para evaluaciones de grupo (todas usan el mismo color).
- El toggle "Mostrar evaluaciones en el horario" también debe afectar a las evaluaciones grupales.
