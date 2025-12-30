# 🎵 KikoBingo - Documentación del Proyecto

## Descripción General

**KikoBingo** es una aplicación web de bingo musical interactivo que permite a un administrador crear sesiones de juego basadas en playlists de Spotify, y a los jugadores unirse y competir marcando canciones en sus cartones únicos.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Browser)                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │     Vista Admin         │  │      Vista Jugador          │   │
│  │  - Crear sesión         │  │  - Unirse a sesión          │   │
│  │  - Lista de canciones   │  │  - Cartón de bingo          │   │
│  │  - Compartir QR/WA      │  │  - Marcar canciones         │   │
│  └───────────┬─────────────┘  └──────────────┬──────────────┘   │
│              │                                │                   │
│              └────────────┬───────────────────┘                   │
│                           │ Socket.IO                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                           ▼                                      │
│                    SERVIDOR (Node.js)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Express + Socket.IO                   │    │
│  │  - Manejo de sesiones en memoria                        │    │
│  │  - Eventos WebSocket bidireccionales                    │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                        │
│          ┌──────────────┴──────────────┐                        │
│          ▼                              ▼                        │
│  ┌───────────────┐              ┌───────────────┐               │
│  │  Spotify API  │              │   Firebase    │               │
│  │  (Playlists)  │              │  (Firestore)  │               │
│  └───────────────┘              └───────────────┘               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 📁 Estructura de Archivos

```
bingo_musical_web/
├── .agents/                 # Documentación del proyecto
│   ├── README.md           # Este archivo
│   ├── STYLES.md           # Guía de estilos y diseño
│   ├── ARCHITECTURE.md     # Arquitectura detallada
│   └── DEVELOPMENT.md      # Guía de desarrollo
├── public/                  # Archivos estáticos (frontend)
│   ├── index.html          # Página principal SPA
│   ├── style.css           # Estilos CSS personalizados
│   └── img/
│       └── kiko.png        # Logo de la aplicación
├── server.js               # Servidor Node.js principal
├── serviceAccountKey.json  # Credenciales Firebase (no en git)
├── nginx.conf              # Configuración de producción
├── package.json            # Dependencias y scripts
└── node_modules/           # Dependencias instaladas
```

## 🔧 Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML5, TailwindCSS, CSS3 personalizado, JavaScript vanilla |
| **Backend** | Node.js, Express.js |
| **Tiempo Real** | Socket.IO |
| **Base de Datos** | Firebase Firestore |
| **API Externa** | Spotify Web API |
| **Producción** | Nginx (reverse proxy + SSL) |

## 🎮 Flujo del Juego

### 1. Administrador
1. Accede a `https://kikobingo.com` (sin parámetros)
2. Pega URL de playlist pública de Spotify
3. Crea sesión → Obtiene ID, QR y enlace
4. Comparte enlace con jugadores (WhatsApp, QR)
5. Ve lista de canciones para ir marcando las reproducidas

### 2. Jugador
1. Accede mediante enlace `?sid=XXXXX` o introduce ID manualmente
2. Recibe cartón único con 20 canciones aleatorias
3. Marca canciones conforme suenan
4. **LÍNEA**: 5 canciones marcadas
5. **BINGO**: Todas las canciones del cartón

## 🔌 Eventos Socket.IO

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `createSession` | Cliente → Servidor | Admin crea sesión con URL de playlist |
| `sessionCreated` | Servidor → Cliente | Confirmación con ID, enlace y canciones |
| `joinSession` | Cliente → Servidor | Jugador se une con sessionId y userId |
| `sessionJoined` | Servidor → Cliente | Envía cartón único al jugador |
| `sessionError` | Servidor → Cliente | Notifica errores |
| `setRole` | Cliente → Servidor | Define rol (admin/player) |

## 🌐 Dominio y Producción

- **Dominio**: `kikobingo.com`
- **SSL**: Let's Encrypt
- **Puerto interno**: 3001
- **Nginx**: Reverse proxy con soporte WebSocket

## 📋 Variables de Entorno

```env
SPOTIFY_CLIENT_ID=xxxxx
SPOTIFY_CLIENT_SECRET=xxxxx
PORT=3001
```

## 🚀 Comandos

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

---

Para más detalles, consulta los otros archivos de documentación en esta carpeta.

