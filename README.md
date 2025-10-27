# Proyecto gestión

Repositorio inicial para el sistema familia.

## Sincronización en la nube con Firebase

La aplicación utiliza Firebase Firestore para sincronizar en tiempo real las tareas, apartados y monederos entre el panel de administración y los usuarios básicos.

### Pasos de configuración

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y habilita Firestore en modo production.
2. Genera las credenciales web desde **Project settings → General → Your apps → Web app**.
3. Copia los valores proporcionados y sustituye los marcadores en [`firebase-config.js`](./firebase-config.js).
4. Define reglas de seguridad que restrinjan el acceso solamente a usuarios autenticados que deban usar la aplicación.
5. Publica la aplicación (por ejemplo mediante Firebase Hosting u otro proveedor) y comprueba que tanto el panel de administración como las cuentas básicas ven las actualizaciones en tiempo real.

> **Nota:** La aplicación inicializa automáticamente los usuarios de ejemplo (`admin`/`admin123` y `carlota`/`carlota123`), los apartados base y reiniciará el estado remoto si no existe el documento `appState/global`.

### Estructura almacenada en Firestore

Todos los datos de la aplicación se guardan en un único documento `appState/global` con esta estructura aproximada:

```json
{
  "users": {
    "admin": { "username": "admin", "password": "admin123", "role": "admin", "displayName": "Administrador", "wallet": { "balance": 0, "incomes": [], "expenses": [] } },
    "carlota": { "username": "carlota", "password": "carlota123", "role": "basic", "displayName": "Carlota", "wallet": { "balance": 0, "incomes": [], "expenses": [] } }
  },
  "categories": ["Exámenes", "Tareas del hogar", "Gastos fijos", "Gastos extras"],
  "tasks": [],
  "nextTaskId": 1
}
```

Todas las acciones del administrador (crear tareas, categorías y movimientos de monedero) y las interacciones de los usuarios básicos (marcar tareas completadas y registrar notas de exámenes) se ejecutan mediante transacciones en Firestore para asegurar la consistencia y aparecerán en tiempo real para todos los clientes conectados.

### Scripts de desarrollo

El script `npm run verify:users` ya no realiza comprobaciones automáticas porque el código depende ahora del SDK modular de Firebase cargado desde CDN.
