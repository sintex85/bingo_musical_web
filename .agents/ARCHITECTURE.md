# 🏗️ KikoBingo - Arquitectura Técnica

## Visión General

KikoBingo es una **Single Page Application (SPA)** con comunicación en tiempo real mediante WebSockets. La arquitectura sigue un modelo cliente-servidor con estado compartido.

## 📦 Dependencias

### Producción

```json
{
    "dotenv": "^16.3.1",       // Variables de entorno
    "express": "^4.18.2",       // Servidor HTTP
    "firebase-admin": "^12.0.0", // SDK Firebase Admin
    "socket.io": "^4.7.5",      // WebSockets
    "spotify-web-api-node": "^5.0.2" // Cliente Spotify
}
```

### Desarrollo

```json
{
    "nodemon": "^3.0.1"  // Hot reload
}
```

### CDN (Frontend)

- **TailwindCSS** - Framework CSS utility-first
- **Font Awesome 6** - Iconos
- **Socket.IO Client** - Cliente WebSocket
- **QRCode.js** - Generador de códigos QR

## 🔌 Servidor (server.js)

### Inicialización

```javascript
// 1. Cargar variables de entorno
require('dotenv').config()

// 2. Configurar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore()

// 3. Configurar Express + Socket.IO
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: ["https://kikobingo.com", "http://localhost:3001"],
        methods: ["GET", "POST"],
        credentials: true
    }
})

// 4. Configurar Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
})
```

### Gestión de Estado

```javascript
// Sesiones en memoria (estructura)
const sessions = {
    "abc123": {
        playlistUrl: "https://open.spotify.com/playlist/...",
        songs: [
            { title: "Canción", artist: "Artista", id: "spotifyId" }
        ],
        players: {
            "player_xyz789": {
                bingoCard: [...],      // 20 canciones únicas
                markedSongs: [],       // IDs marcados
                linesCompleted: 0,
                isBingo: false
            }
        }
    }
}
```

### API de Spotify

```javascript
async function getSpotifyPlaylistSongs(playlistUrl) {
    // 1. Extraer ID de playlist de la URL
    const playlistId = playlistUrl.split('/playlist/')[1]?.split('?')[0]
    
    // 2. Obtener token (Client Credentials Flow)
    const data = await spotifyApi.clientCredentialsGrant()
    spotifyApi.setAccessToken(data.body.access_token)
    
    // 3. Obtener canciones
    const playlist = await spotifyApi.getPlaylist(playlistId)
    
    // 4. Mapear a formato interno
    return playlist.body.tracks.items.map(item => ({
        title: item.track.name,
        artist: item.track.artists[0].name,
        id: item.track.id
    }))
}
```

### Algoritmo de Barajado (Fisher-Yates con Crypto)

```javascript
// Usa crypto.randomBytes para mejor aleatoriedad
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const randomBytes = crypto.randomBytes(4);
        const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
        const j = Math.floor(randomValue * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Cada cartón tiene un hash único para verificación
function getCardHash(card) {
    const ids = card.map(s => s.id || s.title).join(',');
    return crypto.createHash('md5').update(ids).digest('hex').substring(0, 8);
}
```

## 📡 Eventos Socket.IO

### Flujo Completo

```
┌─────────────┐                    ┌─────────────┐
│   ADMIN     │                    │   SERVER    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  createSession({playlistUrl})    │
       │─────────────────────────────────►│
       │                                  │ ─┐ getSpotifyPlaylistSongs()
       │                                  │ ─┘ Guardar en Firestore
       │  sessionCreated({id, url, songs})│
       │◄─────────────────────────────────│
       │                                  │
┌──────┴──────┐                    ┌──────┴──────┐
│   PLAYER    │                    │   SERVER    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  joinSession({sessionId, userId})│
       │─────────────────────────────────►│
       │                                  │ ─┐ shuffleArray(songs)
       │                                  │ ─┘ slice(0, 20)
       │  sessionJoined({sessionId, card})│
       │◄─────────────────────────────────│
       │                                  │
```

## 🗄️ Firebase Firestore

### Estructura de Colecciones

```
firestore/
├── sessions/
│   └── {sessionId}/
│       ├── playlistUrl: string
│       ├── songs: array
│       ├── createdAt: timestamp
│       └── players/
│           └── {playerId}/
│               ├── bingoCard: array[20]
│               ├── markedSongs: array
│               ├── linesCompleted: number
│               ├── isBingo: boolean
│               └── joinedAt: timestamp
└── test/
    └── connection/  # Prueba de conexión
```

### Operaciones

| Operación | Momento | Datos |
|-----------|---------|-------|
| **Create Session** | Admin crea sesión | Playlist, canciones, timestamp |
| **Add Player** | Jugador se une | Cartón, estado inicial |
| **Test Connection** | Inicio servidor | Verificación health |

## 🌐 Cliente (index.html)

### Detección de Rol

```javascript
const initSid = new URLSearchParams(window.location.search).get("sid");

if (initSid) {
    // Modo JUGADOR: tiene ?sid=XXXXX
    socket.emit("setRole", { role: "player" });
    // Auto-unirse a la sesión
    socket.emit("joinSession", { sessionId: initSid, userId });
} else {
    // Modo ADMIN: acceso directo
    socket.emit("setRole", { role: "admin" });
}
```

### Generación de Cartón

El cartón se genera en el **servidor**, no en el cliente:

1. Servidor baraja todas las canciones de la playlist
2. Toma las primeras 20
3. Envía cartón único a cada jugador

### Renderizado del Cartón

```javascript
function renderBingoCard(card) {
    bingoCardDiv.innerHTML = "";
    card.forEach((song) => {
        const cell = document.createElement("div");
        cell.classList.add("bingo-cell");
        cell.innerHTML = `
            <p class="font-bold">${song.title}</p>
            <p class="text-sm">${song.artist}</p>
        `;
        cell.addEventListener("click", () => {
            cell.classList.toggle("marked");
            updatePlayerStats();
        });
        bingoCardDiv.appendChild(cell);
    });
}
```

### Detección de Victoria

```javascript
function updatePlayerStats() {
    const cells = bingoCardDiv.querySelectorAll(".bingo-cell");
    const totalMarked = [...cells].filter(c => 
        c.classList.contains("marked")
    ).length;

    // LÍNEA: exactamente 5 marcadas
    const isLine = totalMarked === 5;
    
    // BINGO: todas las celdas marcadas
    if (totalMarked === cells.length) {
        // ¡BINGO!
    } else if (isLine) {
        // ¡LÍNEA!
    }
}
```

## 🚀 Producción (Nginx)

### Configuración

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name kikobingo.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    
    # SSL con Let's Encrypt
    ssl_certificate /etc/letsencrypt/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/.../privkey.pem;
    
    # Proxy a Node.js
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
    
    # Socket.IO específico
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🔒 Seguridad

### Consideraciones Actuales

1. **CORS** configurado solo para dominios específicos
2. **SSL/TLS** en producción
3. **Credenciales Spotify** en variables de entorno
4. **serviceAccountKey.json** - ⚠️ No subir a git

### Mejoras Recomendadas

1. Añadir rate limiting
2. Validar URLs de playlist
3. Implementar autenticación para admin
4. Añadir límite de jugadores por sesión
5. Expiración de sesiones

## 📊 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUJO DE DATOS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SPOTIFY API                                                    │
│      │                                                          │
│      ▼                                                          │
│  ┌───────────────┐                                              │
│  │ Playlist JSON │                                              │
│  │ (tracks)      │                                              │
│  └───────┬───────┘                                              │
│          │                                                      │
│          ▼                                                      │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   SERVER      │───►│  FIRESTORE    │    │   MEMORIA     │   │
│  │ (transform)   │    │ (persistencia)│    │ (sessions{})  │   │
│  └───────┬───────┘    └───────────────┘    └───────────────┘   │
│          │                                                      │
│          ▼                                                      │
│  ┌───────────────┐                                              │
│  │ Socket.IO     │                                              │
│  │ (broadcast)   │                                              │
│  └───────┬───────┘                                              │
│          │                                                      │
│    ┌─────┴─────┐                                                │
│    ▼           ▼                                                │
│ ┌──────┐  ┌──────────┐                                          │
│ │ADMIN │  │ PLAYERS  │                                          │
│ │(all) │  │(cartón)  │                                          │
│ └──────┘  └──────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

