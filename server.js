const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore()

io.on('connection', socket => {
  socket.on('createSession', async ({ playlistUrl }) => {
    // …tu lógica para generar sessionId y allSongs…
    sessions[sessionId] = { /* … */ }

    // ← Aquí persistes la sesión en Firestore:
    await db.collection('sessions').doc(sessionId).set({
      playlistUrl,
      songs: allSongs,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })

    socket.emit('sessionCreated', { sessionId, joinUrl })
  })

  socket.on('joinSession', async ({ sessionId, userId }) => {
    // …tu lógica de join…
    const bingoCard = /* … */
    sessions[sessionId].players[userId] = { bingoCard, /* … */ }

    // ← Y aquí persistes al jugador:
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

    socket.emit('sessionJoined', { sessionId, bingoCard })
    socket.join(sessionId)
  })
})

function updatePlayerStats() {
  const cells = bingoCardDiv.querySelectorAll(".bingo-cell");
  const totalCells = cells.length; // number of songs in the card
  // Count marked cells
  const totalMarked = Array.from(cells).filter(cell => cell.classList.contains("marked")).length;
  // Update marked count display
  markedCountSpan.textContent = `${totalMarked} / ${totalCells}`;

  // Compute number of complete rows (each row has 'cols' songs)
  const cols = 5;
  const rows = Math.ceil(totalCells / cols);
  let lines = 0;
  for (let r = 0; r < rows; r++) {
    let markedInRow = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < totalCells && cells[idx].classList.contains("marked")) {
        markedInRow++;
      }
    }
    if (markedInRow === cols) lines++;
  }
  linesCountSpan.textContent = lines;

  // Show line or bingo message
  if (totalMarked === totalCells) {
    // Full bingo
    winMessageDiv.textContent = "¡BINGO!";
    winMessageDiv.classList.remove("hidden");
    showMessage("¡BINGO! Has completado todas las canciones.", "success");
  } else if (lines > 0) {
    // At least one completed line
    winMessageDiv.textContent = "¡LÍNEA!";
    winMessageDiv.classList.remove("hidden");
    showMessage(`¡LÍNEA! Has completado ${lines} línea${lines > 1 ? "s" : ""}.`, "info");
  } else {
    // No line or bingo
    winMessageDiv.classList.add("hidden");
  }
}