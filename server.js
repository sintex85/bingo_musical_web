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
      console.log('=== INICIANDO CREACIÓN DE SESIÓN ===')
      console.log('Creando sesión con URL:', playlistUrl)
      console.log('Estado de Firebase Admin:', admin.apps.length > 0 ? 'Inicializado' : 'NO inicializado')
      console.log('Estado de Firestore:', db ? 'Conectado' : 'NO conectado')
      
      const sessionId = Math.random().toString(36).substring(2, 8)
      console.log('SessionId generado:', sessionId)
      
      const allSongs = [
        { title: 'Canción 1', artist: 'Artista 1' }, 
        { title: 'Canción 2', artist: 'Artista 2' },
        { title: 'Canción 3', artist: 'Artista 3' },
        { title: 'Canción 4', artist: 'Artista 4' },
        { title: 'Canción 5', artist: 'Artista 5' }
      ]
      
      sessions[sessionId] = { playlistUrl, songs: allSongs, players: {} }
      console.log('Sesión guardada en memoria:', sessions[sessionId])
      
      const joinUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}?sid=${sessionId}`
      console.log('JoinUrl generado:', joinUrl)

      console.log('=== INTENTANDO GUARDAR EN FIRESTORE ===')
      const sessionData = {
        playlistUrl,
        songs: allSongs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
      console.log('Datos a guardar:', sessionData)
      
      const docRef = await db.collection('sessions').doc(sessionId).set(sessionData)
      console.log('=== FIRESTORE: GUARDADO EXITOSO ===')
      console.log('Document reference:', docRef)

      socket.emit('sessionCreated', { sessionId, joinUrl })
    } catch (err) {
      console.error('=== ERROR COMPLETO ===')
      console.error('Error name:', err.name)
      console.error('Error message:', err.message)
      console.error('Error code:', err.code)
      console.error('Error stack:', err.stack)
      socket.emit('sessionError', 'No se pudo guardar la sesión en Firebase: ' + err.message)
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

server.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000')
})