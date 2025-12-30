require('dotenv').config() // Añadir esta línea al principio

const express = require('express')
const http = require('http')
const crypto = require('crypto')
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

// Función para barajar un array (algoritmo Fisher-Yates mejorado con crypto)
function shuffleArray(array) {
  const shuffled = [...array]; // Crear una copia
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Usar crypto para mejor aleatoriedad
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
    const j = Math.floor(randomValue * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Función para generar un hash simple del cartón (para debug)
function getCardHash(card) {
  const ids = card.map(s => s.id || s.title).join(',');
  return crypto.createHash('md5').update(ids).digest('hex').substring(0, 8);
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
      // Intentar recuperar sesión de Firestore si no está en memoria
      if (!sessions[sessionId]) {
        console.log(`⚠️ Sesión ${sessionId} no está en memoria, intentando recuperar de Firestore...`);
        try {
          const sessionDoc = await db.collection('sessions').doc(sessionId).get();
          if (sessionDoc.exists) {
            const data = sessionDoc.data();
            sessions[sessionId] = {
              playlistUrl: data.playlistUrl,
              songs: data.songs,
              players: {}
            };
            console.log(`✅ Sesión ${sessionId} recuperada de Firestore con ${data.songs.length} canciones`);
          } else {
            return socket.emit('sessionError', 'Sessió no trobada');
          }
        } catch (firestoreErr) {
          console.error('Error recuperando de Firestore:', firestoreErr);
          return socket.emit('sessionError', 'Sessió no trobada');
        }
      }
      
      console.log(`\n=== 🎮 JUGADOR UNIÉNDOSE ===`);
      console.log(`👤 Usuario: ${userId}`);
      console.log(`🎯 Sesión: ${sessionId}`);
      console.log(`📀 Total canciones disponibles: ${sessions[sessionId].songs.length}`);
      console.log(`👥 Jugadores actuales: ${Object.keys(sessions[sessionId].players).length}`);
      
      // GENERAR CARTÓN ÚNICO: Barajar las canciones y tomar 20
      const allSongs = sessions[sessionId].songs;
      
      // Verificar que hay suficientes canciones
      if (allSongs.length < 20) {
        console.error(`❌ Error: Solo hay ${allSongs.length} canciones, se necesitan mínimo 20`);
        return socket.emit('sessionError', `La playlist necesita mínim 20 cançons (té ${allSongs.length})`);
      }
      
      let shuffledSongs = shuffleArray(allSongs);
      let uniqueBingoCard = shuffledSongs.slice(0, 20);
      let cardHash = getCardHash(uniqueBingoCard);
      
      console.log(`🎲 Cartón inicial generado - Hash: ${cardHash}`);
      console.log(`📋 Primeras 5 canciones del cartón:`, uniqueBingoCard.slice(0, 5).map(s => s.title));
      
      // Verificar si el cartón es único comparando con otros jugadores
      const existingHashes = Object.values(sessions[sessionId].players)
        .map(p => p.cardHash || getCardHash(p.bingoCard));
      
      console.log(`🔍 Hashes existentes: [${existingHashes.join(', ')}]`);
      
      if (existingHashes.includes(cardHash)) {
        console.log(`⚠️ Hash duplicado detectado, regenerando cartón...`);
        // Regenerar hasta obtener uno único (máximo 10 intentos)
        let attempts = 0;
        while (existingHashes.includes(cardHash) && attempts < 10) {
          shuffledSongs = shuffleArray(allSongs);
          uniqueBingoCard = shuffledSongs.slice(0, 20);
          cardHash = getCardHash(uniqueBingoCard);
          attempts++;
          console.log(`   Intento ${attempts}: Hash ${cardHash}`);
        }
        console.log(`✅ Nuevo cartón generado después de ${attempts} intentos - Hash: ${cardHash}`);
      }
      
      // Guardar el jugador con su cartón único
      sessions[sessionId].players[userId] = { 
        bingoCard: uniqueBingoCard,
        cardHash: cardHash,
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
          cardHash: cardHash,
          markedSongs: [],
          linesCompleted: 0,
          isBingo: false,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      
      console.log(`✅ Jugador ${userId} guardado con cartón único (Hash: ${cardHash})`);

      // Enviar el cartón único al jugador
      socket.emit('sessionJoined', { 
        sessionId, 
        bingoCard: uniqueBingoCard,
        cardHash: cardHash
      });
      
      socket.join(sessionId);
      
      console.log(`✅ Jugador ${userId} unido exitosamente a sesión ${sessionId}`);
      console.log(`=== FIN UNIÓN JUGADOR ===\n`);
      
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