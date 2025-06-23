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
const io = new Server(server, {
  cors: {
    origin: ["https://kikobingo.com", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
})

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
    console.log('🎵 === DEBUG SPOTIFY ===')
    console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID)
    console.log('Client Secret existeix:', !!process.env.SPOTIFY_CLIENT_SECRET)
    console.log('URL rebuda:', playlistUrl)
    
    // Extraer el ID de la playlist de la URL
    const playlistId = playlistUrl.split('/playlist/')[1]?.split('?')[0]
    console.log('Playlist ID extret:', playlistId)
    
    if (!playlistId) {
      throw new Error('URL de playlist invàlida')
    }

    // Obtener token de acceso
    console.log('Obtenint token de Spotify...')
    const data = await spotifyApi.clientCredentialsGrant()
    
    spotifyApi.setAccessToken(data.body.access_token)
    console.log('✅ Token aplicat correctament:', data.body.access_token.substring(0, 20) + '...')

    // Obtener las canciones de la playlist
    console.log('Obtenint playlist...')
    const playlist = await spotifyApi.getPlaylist(playlistId)
    const tracks = playlist.body.tracks.items
    console.log(`✅ S'han obtingut ${tracks.length} tracks de Spotify`)

    const songs = tracks.map(item => ({
      title: item.track.name,
      artist: item.track.artists[0].name,
      id: item.track.id
    }))
    
    console.log('Primeres 3 cançons:', songs.slice(0, 3))
    return songs
  } catch (error) {
    console.error('❌ Error obtenint playlist de Spotify:', error.message)
    console.error('❌ Error stack:', error.stack)
    console.error('Usant cançons d\'exemple...')
    // Fallback a canciones de ejemplo
    return [
      { title: 'Cançó 1', artist: 'Artista 1' },
      { title: 'Cançó 2', artist: 'Artista 2' },
      { title: 'Cançó 3', artist: 'Artista 3' },
      { title: 'Cançó 4', artist: 'Artista 4' },
      { title: 'Cançó 5', artist: 'Artista 5' }
    ]
  }
}

// Función para barajar un array (algoritmo Fisher-Yates)
function shuffleArray(array) {
  const shuffled = [...array]; // Crear una copia
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

io.on('connection', socket => {
  console.log('Usuari connectat:', socket.id)

  socket.on('createSession', async ({ playlistUrl }) => {
    try {
      console.log('=== INICIANT CREACIÓ DE SESSIÓ ===')
      console.log('Creant sessió amb URL:', playlistUrl)
      
      const sessionId = Math.random().toString(36).substring(2, 8)
      console.log('SessionId generat:', sessionId)
      
      console.log('Obtenint cançons de Spotify...')
      const allSongs = await getSpotifyPlaylistSongs(playlistUrl)
      console.log(`S'han obtingut ${allSongs.length} cançons`)
      
      sessions[sessionId] = { playlistUrl, songs: allSongs, players: {} }
      
      const joinUrl = `https://kikobingo.com?sid=${sessionId}`
      console.log('JoinUrl generat:', joinUrl)

      console.log('=== INTENTANT GUARDAR EN FIRESTORE ===')
      const sessionData = {
        playlistUrl,
        songs: allSongs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
      
      await db.collection('sessions').doc(sessionId).set(sessionData)
      console.log('=== FIRESTORE: GUARDAT EXITÓS ===')

      // IMPORTANTE: Enviar las canciones al admin
      console.log('Enviant resposta amb', allSongs.length, 'cançons al client...')
      socket.emit('sessionCreated', { 
        sessionId, 
        joinUrl, 
        songs: allSongs 
      })
    } catch (err) {
      console.error('=== ERROR COMPLET ===', err)
      socket.emit('sessionError', 'No s\'ha pogut crear la sessió: ' + err.message)
    }
  })

  socket.on('joinSession', async ({ sessionId, userId }) => {
    try {
      if (!sessions[sessionId]) {
        return socket.emit('sessionError', 'Sessió no trobada');
      }
      
      console.log(`=== JUGADOR UNIÉNDOSE ===`);
      console.log(`Usuari: ${userId}`);
      console.log(`Sessió: ${sessionId}`);
      console.log(`Total canciones en sesión: ${sessions[sessionId].songs.length}`);
      
      // GENERAR CARTÓN ÚNICO: Barajar las canciones y tomar 20
      const allSongs = sessions[sessionId].songs;
      const shuffledSongs = shuffleArray(allSongs);
      const uniqueBingoCard = shuffledSongs.slice(0, 20);
      
      console.log(`Cartón generado para ${userId}:`, uniqueBingoCard.map(s => s.title));
      
      // Guardar el jugador con su cartón único
      sessions[sessionId].players[userId] = { 
        bingoCard: uniqueBingoCard,
        markedSongs: [],
        linesCompleted: 0,
        isBingo: false
      };

      // Guardar jugador en Firestore
      await db
        .collection('sessions').doc(sessionId)
        .collection('players').doc(userId)
        .set({
          bingoCard: uniqueBingoCard,
          markedSongs: [],
          linesCompleted: 0,
          isBingo: false,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      
      console.log(`✅ Jugador ${userId} guardado con cartón único`);

      // Enviar el cartón único al jugador
      socket.emit('sessionJoined', { 
        sessionId, 
        bingoCard: uniqueBingoCard 
      });
      
      socket.join(sessionId);
      
      console.log(`✅ Jugador ${userId} unido exitosamente a sesión ${sessionId}`);
      
    } catch (err) {
      console.error('Error en joinSession:', err);
      socket.emit('sessionError', 'Error al unir-se a la sessió');
    }
  });
})

// Función de prueba para verificar conexión
async function testFirestoreConnection() {
  try {
    console.log('=== PROVANT CONNEXIÓ A FIRESTORE ===')
    const testDoc = await db.collection('test').doc('connection').set({
      message: 'Connexió exitosa',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('✅ Firestore connectat correctament')
    
    const doc = await db.collection('test').doc('connection').get()
    if (doc.exists) {
      console.log('✅ Lectura confirmada:', doc.data())
    }
  } catch (error) {
    console.error('❌ Error connectant a Firestore:', error)
  }
}

// Llamar la función de prueba al iniciar
testFirestoreConnection()

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`)
  console.log(`Servidor disponible en http://0.0.0.0:${PORT}`)
})