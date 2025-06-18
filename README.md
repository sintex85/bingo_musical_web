# Bingo Musical Web (Python)

Esta es una versión sencilla de un bingo musical implementada en Python usando [aiohttp](https://aiohttp.readthedocs.io/). No requiere Node.js y mantiene una funcionalidad similar a la versión anterior.

## Requisitos

- Python 3.8 o superior
- Las variables de entorno `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` con las credenciales de una aplicación de Spotify

## Instalación

```bash
pip install -r requirements.txt
```

## Uso

```bash
python app.py
```

El servidor quedará disponible en `http://localhost:3333`. Desde esa URL se accede al panel de administración. Al crear la partida se genera un enlace para que los jugadores se unan.

Esta aplicación guarda toda la información en memoria, por lo que las partidas se pierden al reiniciar. Se incluye un ejemplo sencillo y no gestiona audio ni autenticación avanzada.
