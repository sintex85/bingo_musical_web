# Bingo Musical Web

Esta es una implementación mínima de una aplicación de Bingo Musical utilizando Node.js, Express y la API de Spotify. Permite crear una sesión de bingo a partir de una playlist pública de Spotify y que los jugadores se unan desde su navegador.

## Instalación

```
npm install
```

Debes definir las variables de entorno `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` con las credenciales de tu aplicación de Spotify.

## Uso

```
node server.js
```

Accede a `http://localhost:3000` para el panel de administración. Al crear la partida se generará un enlace para que los jugadores se unan.

Esta aplicación es solo un ejemplo y no gestiona audio ni autenticación avanzada.
