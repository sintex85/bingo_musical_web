require('dotenv').config() // Añadir esta línea al principio

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const admin = require('firebase-admin')
const SpotifyWebApi = require('spotify-web-api-node')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore()

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Configurar Spotify API con variables de entorno
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
})

// Servir archivos estáticos
app.use(express.static('public'))

const sessions = {}

// Función para obtener canciones de una playlist de Spotify
async function getSpotifyPlaylistSongs(playlistUrl) {
  try {
    console.log('🎵 === SPOTIFY DEBUG ===')
    console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID)
    console.log('Client Secret existe:', !!process.env.SPOTIFY_CLIENT_SECRET)
    console.log('URL recibida:', playlistUrl)
    
    // Extraer el ID de la playlist de la URL
    const playlistId = playlistUrl.split('/playlist/')[1]?.split('?')[0]
    console.log('Playlist ID extraído:', playlistId)
    
    if (!playlistId) {
      throw new Error('URL de playlist inválida')
    }

    // Obtener token de acceso
    console.log('Obteniendo token de Spotify...')
    const data = await spotifyApi.clientCredentialsGrant()
    
    // IMPORTANTE: aplicar el token antes de hacer cualquier llamada
    spotifyApi.setAccessToken(data.body.access_token)
    console.log('✅ Token aplicado correctamente:', data.body.access_token.substring(0, 20) + '...')

    // Obtener las canciones de la playlist
    console.log('Obteniendo playlist...')
    const playlist = await spotifyApi.getPlaylist(playlistId)
    const tracks = playlist.body.tracks.items
    console.log(`✅ Se obtuvieron ${tracks.length} tracks de Spotify`)

    const songs = tracks.map(item => ({
      title: item.track.name,
      artist: item.track.artists[0].name,
      id: item.track.id
    }))
    
    console.log('Primeras 3 canciones:', songs.slice(0, 3))
    return songs
  } catch (error) {
    console.error('❌ Error obteniendo playlist de Spotify:', error.message)
    console.error('❌ Error stack:', error.stack)
    console.error('Usando canciones de ejemplo...')
    // Fallback a canciones de ejemplo
    return [
      { title: 'Canción 1', artist: 'Artista 1' },
      { title: 'Canción 2', artist: 'Artista 2' },
      { title: 'Canción 3', artist: 'Artista 3' },
      { title: 'Canción 4', artist: 'Artista 4' },
      { title: 'Canción 5', artist: 'Artista 5' }
    ]
  }
}

io.on('connection', socket => {
  console.log('Usuario conectado:', socket.id)

  socket.on('createSession', async ({ playlistUrl }) => {
    try {
      console.log('=== INICIANDO CREACIÓN DE SESIÓN ===')
      console.log('Creando sesión con URL:', playlistUrl)
      
      const sessionId = Math.random().toString(36).substring(2, 8)
      console.log('SessionId generado:', sessionId)
      
      // Obtener canciones reales de Spotify
      console.log('Obteniendo canciones de Spotify...')
      const allSongs = await getSpotifyPlaylistSongs(playlistUrl)
      console.log(`Se obtuvieron ${allSongs.length} canciones`)
      
      sessions[sessionId] = { playlistUrl, songs: allSongs, players: {} }
      
      // URL con dominio correcto
      const joinUrl = `https://kikobingo.com?sid=${sessionId}`
      console.log('JoinUrl generado:', joinUrl)

      console.log('=== INTENTANDO GUARDAR EN FIRESTORE ===')
      const sessionData = {
        playlistUrl,
        songs: allSongs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
      
      await db.collection('sessions').doc(sessionId).set(sessionData)
      console.log('=== FIRESTORE: GUARDADO EXITOSO ===')

      socket.emit('sessionCreated', { sessionId, joinUrl })
    } catch (err) {
      console.error('=== ERROR COMPLETO ===', err)
      socket.emit('sessionError', 'No se pudo crear la sesión: ' + err.message)
    }
  })

  socket.on('joinSession', async ({ sessionId, userId }) => {
    try {
      if (!sessions[sessionId]) {
        return socket.emit('sessionError', 'Sesión no encontrada')
      }
      
      console.log(`Usuario ${userId} uniéndose a sesión ${sessionId}`)
      const bingoCard = sessions[sessionId].songs.slice(0, 20)
      sessions[sessionId].players[userId] = { bingoCard }

      console.log('Guardando jugador en Firestore...')
      await db
        .collection('sessions').doc(sessionId)
        .collection('players').doc(userId)
        .set({
          bingoCard,
          markedSongs: [],
          linesCompleted: 0,
          isBingo: false,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      console.log('Jugador guardado exitosamente en Firestore')

      socket.emit('sessionJoined', { sessionId, bingoCard })
      socket.join(sessionId)
    } catch (err) {
      console.error('Error guardando jugador en Firestore:', err)
      socket.emit('sessionError', 'Error al unirse a la sesión')
    }
  })
})

// Función de prueba para verificar conexión
async function testFirestoreConnection() {
  try {
    console.log('=== PROBANDO CONEXIÓN A FIRESTORE ===')
    const testDoc = await db.collection('test').doc('connection').set({
      message: 'Conexión exitosa',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('✅ Firestore conectado correctamente')
    
    // Leer el documento para confirmar
    const doc = await db.collection('test').doc('connection').get()
    if (doc.exists) {
      console.log('✅ Lectura confirmada:', doc.data())
    }
  } catch (error) {
    console.error('❌ Error conectando a Firestore:', error)
  }
}

// Llamar la función de prueba al iniciar
testFirestoreConnection()

const PORT = process.env.PORT || 3001; // Cambiar de 3000 a 3001

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`)
})