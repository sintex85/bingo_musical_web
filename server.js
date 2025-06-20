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

// Configurar Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID || 'tu_client_id',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'tu_client_secret'
})

// Servir archivos estáticos
app.use(express.static('public'))

const sessions = {}

// Función para obtener canciones de una playlist de Spotify
async function getSpotifyPlaylistSongs(playlistUrl) {
  try {
    // Extraer el ID de la playlist de la URL
    const playlistId = playlistUrl.split('/playlist/')[1]?.split('?')[0]
    
    if (!playlistId) {
      throw new Error('URL de playlist inválida')
    }

    // Obtener token de acceso
    const data = await spotifyApi.clientCredentialsGrant()
    spotifyApi.setAccessToken(data.body['access_token'])

    // Obtener las canciones de la playlist
    const playlist = await spotifyApi.getPlaylist(playlistId)
    const tracks = playlist.body.tracks.items

    return tracks.map(item => ({
      title: item.track.name,
      artist: item.track.artists[0].name,
      id: item.track.id
    }))
  } catch (error) {
    console.error('Error obteniendo playlist de Spotify:', error)
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
      
      // URL corregida sin localhost
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