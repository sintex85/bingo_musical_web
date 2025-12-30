# 🛠️ KikoBingo - Guía de Desarrollo

## Requisitos Previos

- **Node.js** >= 18.x
- **npm** >= 9.x
- Cuenta de **Spotify Developer**
- Proyecto de **Firebase** con Firestore habilitado

## 🚀 Configuración Inicial

### 1. Clonar y Dependencias

```bash
cd bingo_musical_web
npm install
```

### 2. Variables de Entorno

Crear archivo `.env` en la raíz:

```env
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify
PORT=3001
```

### 3. Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Crear proyecto o seleccionar existente
3. Habilitar Firestore Database
4. Ir a Configuración > Cuentas de servicio
5. Generar nueva clave privada
6. Guardar como `serviceAccountKey.json` en la raíz

⚠️ **IMPORTANTE**: Añadir `serviceAccountKey.json` a `.gitignore`

### 4. Spotify Developer

1. Ir a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Crear aplicación
3. Copiar Client ID y Client Secret
4. No necesitas Redirect URI (usamos Client Credentials Flow)

## 💻 Desarrollo Local

### Iniciar Servidor

```bash
# Con hot reload (recomendado)
npm run dev

# Sin hot reload
npm start
```

### Acceder a la App

- **Admin**: `http://localhost:3001`
- **Jugador**: `http://localhost:3001?sid=CODIGO_SESION`

### Debug

Los logs del servidor muestran:
- 🎵 Conexión a Spotify
- ✅ Operaciones exitosas
- ❌ Errores con stack trace

## 📁 Archivos Clave

### server.js

| Líneas | Función |
|--------|---------|
| 1-14 | Inicialización y configuración |
| 26-29 | Configuración Spotify API |
| 37-86 | `getSpotifyPlaylistSongs()` |
| 88-96 | `shuffleArray()` (Fisher-Yates) |
| 98-196 | Eventos Socket.IO |
| 199-218 | Test conexión Firestore |

### public/index.html

| Sección | Descripción |
|---------|-------------|
| `#admin-panel` | Vista completa del administrador |
| `#player-view` | Vista del jugador |
| `#orientation-warning` | Aviso de rotación móvil |
| `<script>` | Lógica cliente Socket.IO |

### public/style.css

| Líneas | Sección |
|--------|---------|
| 1-22 | Variables CSS (colores) |
| 23-79 | Estilos base |
| 80-163 | Botones |
| 165-288 | Header y títulos |
| 290-372 | Cartón de bingo |
| 374-502 | Componentes UI |
| 513-597 | Vistas específicas |
| 717-1100 | Responsive y orientación |

## 🧪 Testing Manual

### Flujo Admin

1. Abrir `http://localhost:3001`
2. Pegar URL de playlist Spotify pública
3. Verificar:
   - Se genera ID de sesión
   - Aparece código QR
   - Lista de canciones se muestra
   - Botón WhatsApp funciona

### Flujo Jugador

1. Copiar enlace de sesión
2. Abrir en otra pestaña/dispositivo
3. Verificar:
   - Cartón tiene 20 canciones
   - Se pueden marcar celdas
   - Contador actualiza
   - Línea detecta 5 marcadas
   - Bingo detecta todas marcadas

### Probar Móvil

1. Usar DevTools > Toggle device toolbar
2. Seleccionar dispositivo móvil
3. Modo portrait → debe mostrar aviso rotación
4. Modo landscape → debe mostrar juego

## 🔧 Tareas Comunes

### Añadir Nuevo Evento Socket

**Servidor (server.js)**:
```javascript
io.on('connection', socket => {
    // ...
    socket.on('nuevoEvento', async (data) => {
        // Lógica
        socket.emit('respuestaEvento', { resultado });
    });
});
```

**Cliente (index.html)**:
```javascript
socket.emit('nuevoEvento', { datos });
socket.on('respuestaEvento', ({ resultado }) => {
    // Manejar respuesta
});
```

### Modificar Estilos

1. Editar `public/style.css`
2. Usar variables CSS existentes
3. Mantener convenciones de nombrado
4. Añadir media queries si es responsive

### Añadir Nueva Vista

1. Crear `<div id="nueva-vista">` en index.html
2. Añadir estilos en style.css
3. Controlar visibilidad con `.hidden`
4. Añadir lógica JavaScript para mostrar/ocultar

## 🐛 Problemas Comunes

### "Socket.IO no definido"

- Verificar que el CDN de Socket.IO carga correctamente
- Comprobar conexión a internet
- Revisar consola del navegador

### "Playlist no encontrada"

- Verificar que la playlist es **pública**
- Comprobar formato URL: `https://open.spotify.com/playlist/XXXXX`
- Revisar credenciales Spotify en `.env`

### "Error Firestore"

- Verificar `serviceAccountKey.json` existe
- Comprobar permisos en Firebase Console
- Revisar logs del servidor

### Cartón vacío

- Verificar que la playlist tiene canciones
- Comprobar logs del servidor (número de tracks)
- Revisar respuesta de `sessionJoined`

## 🚀 Deploy a Producción

### 1. Servidor

```bash
# Instalar PM2 (gestor de procesos)
npm install -g pm2

# Iniciar aplicación
pm2 start server.js --name kikobingo

# Configurar inicio automático
pm2 startup
pm2 save
```

### 2. Nginx

Copiar `nginx.conf` a `/etc/nginx/sites-available/kikobingo`:

```bash
sudo ln -s /etc/nginx/sites-available/kikobingo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL con Certbot

```bash
sudo certbot --nginx -d kikobingo.com
```

## 📊 Monitoreo

### Logs PM2

```bash
pm2 logs kikobingo
pm2 monit
```

### Nginx Logs

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🔮 Mejoras Futuras

### Funcionalidad

- [ ] Sistema de puntuación
- [ ] Múltiples rondas por sesión
- [ ] Historial de partidas
- [ ] Notificaciones push

### Técnico

- [ ] Tests automatizados (Jest)
- [ ] TypeScript
- [ ] Docker
- [ ] CI/CD pipeline

### UX

- [ ] Sonidos de feedback
- [ ] Animaciones de victoria
- [ ] Temas personalizables
- [ ] PWA (instalable)

