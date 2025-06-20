const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore()

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Servir archivos estáticos
app.use(express.static('public'))

const sessions = {}

io.on('connection', socket => {
  console.log('Usuario conectado:', socket.id)

  socket.on('createSession', async ({ playlistUrl }) => {
    try {
      console.log('Creando sesión con URL:', playlistUrl)
      const sessionId = Math.random().toString(36).substring(2, 8)
      const allSongs = [
        { title: 'Canción 1', artist: 'Artista 1' }, 
        { title: 'Canción 2', artist: 'Artista 2' },
        { title: 'Canción 3', artist: 'Artista 3' },
        { title: 'Canción 4', artist: 'Artista 4' },
        { title: 'Canción 5', artist: 'Artista 5' }
      ]
      sessions[sessionId] = { playlistUrl, songs: allSongs, players: {} }
      const joinUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}?sid=${sessionId}`

      console.log('Guardando sesión en Firestore...')
      const docRef = await db.collection('sessions').doc(sessionId).set({
        playlistUrl,
        songs: allSongs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('Sesión guardada exitosamente en Firestore')

      socket.emit('sessionCreated', { sessionId, joinUrl })
    } catch (err) {
      console.error('Error guardando sesión en Firestore:', err)
      socket.emit('sessionError', 'No se pudo guardar la sesión en Firebase')
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

server.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000')
})