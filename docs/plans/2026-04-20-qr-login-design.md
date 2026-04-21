# QR Login Design — Web ↔ Móvil

## Objetivo
Permitir que un usuario autentique la sesión web escaneando un QR desde la app móvil, sin escribir email ni contraseña. Cubre dos casos: móvil ya logueado (broadcast inmediato) y móvil sin sesión (login inline → broadcast).

## Arquitectura

```
[Web - LoginModal]          [Supabase Realtime]        [Móvil - Scanner]
  genera UUID        →    canal "qr-login:{uuid}"  ←    escanea QR
  muestra QR              (broadcast en memoria)        envía sesión
  escucha canal      ←    recibe tokens            →    cierra scanner
  setSession()
```

## Payload del QR
```json
{ "type": "cursus-qr-login", "channel": "uuid-aqui", "exp": 1234567890 }
```

## Flujo

1. Web genera UUID → suscribe canal Realtime → muestra QR
2. Móvil escanea → valida `exp` (rechaza si expirado)
3. Si móvil tiene sesión: broadcast `{access_token, refresh_token}` inmediato
4. Si móvil sin sesión: muestra form de login inline → tras login → broadcast
5. Web recibe broadcast → `supabase.auth.setSession()` → logueada → cierra modal
6. Canal Realtime se destruye en ambos lados

## UI

| Dónde | Qué |
|---|---|
| `LoginModal` web | Nueva pestaña "QR": QR code + countdown 2 min + estado (esperando / escaneado / listo) |
| `LoginModal` móvil | Botón "Escanear QR de la web" como alternativa al email/password |
| `ConfigScreen` móvil (CUENTA Y SYNC, logged in) | Botón "Escanear QR de la web" |

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/components/LoginModal.tsx` | + pestaña QR (web) + botón escanear (móvil) |
| `src/components/QrScannerModal.tsx` | + detección payload `cursus-qr-login` + broadcast + form inline |
| `src/screens/ConfigScreen.tsx` | + botón escanear en CUENTA Y SYNC (móvil, solo si logged in) |
| `src/store/useAuthStore.ts` | + `setSessionFromTokens(access, refresh)` |

## Seguridad

- QR expira en 2 minutos; web muestra countdown y regenera al llegar a 0
- UUID generado con `crypto.randomUUID()` — no adivinable
- Móvil valida `exp` antes de actuar
- Canal Realtime se destruye tras el primer uso exitoso
- Tokens nunca se escriben en base de datos
