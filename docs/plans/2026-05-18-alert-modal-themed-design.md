# Alert Modal con Tema de la App — Diseño

## Contexto

La app usa `Alert.alert` de React Native (~60 llamadas) para mostrar mensajes de error, éxito y confirmaciones. En web/desktop (Tauri), estos alertas usan el diálogo nativo del SO, que no respeta el tema de la app. El objetivo es reemplazarlos por un modal con el diseño visual de la app que se adapta al tema configurado.

## Referencia visual

`QrShareModal`: `tema.superficie`, `borderRadius: 16`, `padding: 24`, `maxWidth: 420`, backdrop `rgba(0,0,0,0.75)`.

## API — hook `useAlert()`

```typescript
const { showAlert, showConfirm } = useAlert();

// Alerta informativa — 1 botón
showAlert(titulo: string, mensaje: string, labelBoton?: string): void

// Confirmación — 2 botones
showConfirm(
  titulo: string,
  mensaje: string,
  onConfirmar: () => void,
  opciones?: { labelConfirmar?: string; destructivo?: boolean }
): void
```

## Arquitectura

### Archivo nuevo: `src/contexts/AlertContext.tsx`
- Exporta `AlertProvider`, `useAlert`
- El provider renderiza el modal internamente (sin portal)
- Estado: `config: AlertConfig | null` — `null` = modal cerrado

### Modificación: `src/components/ConfirmModal.tsx`
- `tema.tarjeta` → `tema.superficie` para consistencia visual

### Modificación: `App.tsx`
- Envolver árbol con `<AlertProvider>`

## Diseño visual del modal

| Elemento        | Valor                                      |
|-----------------|--------------------------------------------|
| Fondo           | `tema.superficie`                          |
| Backdrop        | `rgba(0,0,0,0.75)`                         |
| borderRadius    | `16`                                       |
| padding         | `24`                                       |
| maxWidth        | `400`                                      |
| animationType   | `'fade'`                                   |
| Título          | `fontSize: 17`, `fontWeight: '700'`, `tema.texto` |
| Mensaje         | `fontSize: 14`, `tema.textoSecundario`     |
| Botón único     | Ancho completo, `tema.acento`, texto blanco |
| Botón Cancelar  | `tema.fondo`, `tema.textoSecundario`       |
| Botón destructivo | `#F44336`                               |

## Alcance de migración

- Reemplazar todas las llamadas a `Alert.alert` en `src/screens/` y `src/components/`
- Los `ConfirmModal` explícitos en screens (importar, período de examen, etc.) **no se modifican** — ya tienen lógica de estado propia
- El import de `Alert` de react-native se elimina donde quede sin uso
