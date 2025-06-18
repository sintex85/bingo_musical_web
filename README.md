# Bingo Musical Web

Aplicación de ejemplo para jugar al Bingo Musical usando una playlist pública de Spotify.

## Requisitos

- Node.js 18+
- Crear una aplicación en [Spotify Developers](https://developer.spotify.com/) y obtener `Client ID` y `Client Secret`.

## Configuración

1. Copia `.env.example` a `.env` y completa tus credenciales de Spotify.
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor:
   ```bash
   node server.js
   ```
4. Abre `http://localhost:3000` en tu navegador.

## Uso

1. Introduce la URL de una playlist pública de Spotify y pulsa `Crear Partida`.
2. Se generará un enlace para compartir con los jugadores.
3. Cada jugador abre el enlace y recibe un cartón de bingo con 25 canciones aleatorias de la playlist.
4. El administrador puede abrir `admin.html?sessionId=ID` para ver la lista de canciones y reproducir las previews de 30 segundos.

La comunicación en tiempo real se realiza mediante WebSockets (socket.io).
