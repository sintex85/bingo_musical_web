
      function showMessage(message, type = "error") {
        const msgBox = document.getElementById("message-box");
        msgBox.textContent = message;
        msgBox.className = "rounded-lg shadow-lg show"; // Restablece clases y añade 'show'
        if (type === "success") {
          msgBox.style.backgroundColor = "rgba(76, 175, 80, 0.95)"; // Verde para éxito
        } else if (type === "info") {
          msgBox.style.backgroundColor = "rgba(33, 150, 243, 0.95)"; // Azul para información
        } else {
          msgBox.style.backgroundColor = "rgba(230, 57, 70, 0.95)"; // Rojo para error
        }

        setTimeout(() => {
          msgBox.classList.remove("show");
        }, 3000);
      }

      let socket; // Declara la variable socket globalmente para este script

      // Este bloque se ejecuta tan pronto como este script se parsea,
      // después de que socket.io.js ha sido cargado.
      if (typeof io === "undefined") {
        showMessage(
          "Error crítico: El cliente de Socket.IO no se ha cargado correctamente. Por favor, revisa la conexión de red y la configuración del servidor.",
          "error"
        );
        console.error(
          "El objeto 'io' de Socket.IO es indefinido. No se puede continuar con la funcionalidad de Socket.IO."
        );
        // No se inicializa 'socket' y el resto de la lógica dependiente de 'socket'
        // en DOMContentLoaded deberá manejar 'socket' como indefinido.
      } else {
        socket = io(window.location.origin, { transports: ["polling"] }); // Solo long‑polling en producción.
      }

      // Envuelve el resto de la lógica en DOMContentLoaded para asegurar que los elementos HTML existen
      window.addEventListener("DOMContentLoaded", () => {
        const initSid = new URLSearchParams(window.location.search).get("sid");
        if (initSid) {
          // Marcar rol como jugador
          socket.emit("setRole", { role: "player" });
          // Ocultar selector de rol y mostrar vista de jugador
          document.getElementById("role-selection").classList.add("hidden");
          document.getElementById("player-view").classList.remove("hidden");
          // Poner el SID y hacer clic en “Unirse”
          document.getElementById("join-session-id").value = initSid;
          document.getElementById("join-session-btn").click();
          return; // Salir para no ejecutar el resto del setup
        }
        // Si 'socket' no se pudo inicializar (porque 'io' no estaba definido), no continuar con la lógica que lo usa
        if (typeof socket === "undefined") {
          console.error(
            "Socket no se inicializó correctamente en DOMContentLoaded. Abortando lógica dependiente del DOM."
          );
          // Retorna para evitar errores en cascada.
          return;
        }

        let currentSessionId = null;
        let userId = null; // Generado en el lado del cliente para cada jugador que se une a una sesión
        let currentBingoCard = []; // Almacena el cartón de bingo del jugador
        let markedSongs = new Set(); // Almacena los IDs de las canciones marcadas por el jugador actual

        const roleSelectionDiv = document.getElementById("role-selection");
        const adminPanelDiv = document.getElementById("admin-panel");
        const playerViewDiv = document.getElementById("player-view");

        const adminBtn = document.getElementById("admin-btn");
        const playerBtn = document.getElementById("player-btn");

        const createSessionBtn = document.getElementById("create-session-btn");
        const playlistUrlInput = document.getElementById("playlist-url");
        const sessionIdDisplay = document.getElementById("session-id-display");
        const joinLink = document.getElementById("join-link");
        const qrcodeDiv = document.getElementById("qrcode");
        const sessionInfoDiv = document.getElementById("session-info");
        const audioPlayer = document.getElementById("audio-player");
        const playPauseBtn = document.getElementById("play-pause-btn");
        const nextSongBtn = document.getElementById("next-song-btn");
        const currentSongInfo = document.getElementById("current-song-info");
        const checkWinnersBtn = document.getElementById("check-winners-btn");
        const winnerDisplay = document.getElementById("winner-display");

        const joinSessionIdInput = document.getElementById("join-session-id");
        const joinSessionBtn = document.getElementById("join-session-btn");
        const gameAreaDiv = document.getElementById("game-area");
        const bingoCardDiv = document.getElementById("bingo-card");
        const markedCountSpan = document.getElementById("marked-count");
        const linesCountSpan = document.getElementById("lines-count");
        const winMessageDiv = document.getElementById("win-message");

        // --- Lógica de Selección de Rol ---
        adminBtn.addEventListener("click", () => {
          roleSelectionDiv.classList.add("hidden");
          adminPanelDiv.classList.remove("hidden");
          // Informa al servidor que este socket es un admin
          socket.emit("setRole", { role: "admin" });
        });

        playerBtn.addEventListener("click", () => {
          roleSelectionDiv.classList.add("hidden");
          playerViewDiv.classList.remove("hidden");
          // Informa al servidor que este socket es un jugador
          socket.emit("setRole", { role: "player" });
          // Si la URL contiene el ID de sesión, unirse automáticamente
          const urlParams = new URLSearchParams(window.location.search);
          const sid = urlParams.get("sid");
          if (sid) {
            joinSessionIdInput.value = sid;
            joinSessionBtn.click(); // Dispara la unión
          }
        });

        // --- Lógica de Admin ---
        createSessionBtn.addEventListener("click", () => {
          const playlistUrl = playlistUrlInput.value.trim();
          if (playlistUrl) {
            showMessage("Creando sesión y obteniendo playlist...", "info");
            socket.emit("createSession", { playlistUrl });
          } else {
            showMessage("Por favor, introduce una URL de playlist válida.");
          }
        });

        socket.on("sessionCreated", ({ sessionId, joinUrl }) => {
          currentSessionId = sessionId;
          sessionIdDisplay.textContent = sessionId;
          joinLink.href = joinUrl;
          joinLink.textContent = joinUrl;
          sessionInfoDiv.classList.remove("hidden");
          showMessage(
            "Sesión creada con éxito. Comparte el enlace.",
            "success"
          );

          // Generar código QR
          new QRCode(qrcodeDiv, {
            text: joinUrl,
            width: 128,
            height: 128,
            colorDark: "#1d3557",
            colorLight: "#f1faee",
            correctLevel: QRCode.CorrectLevel.H,
          });
        });

        socket.on("sessionError", (message) => {
          showMessage(message);
        });

        playPauseBtn.addEventListener("click", () => {
          if (!currentSessionId) {
            showMessage("Primero debes crear o unirte a una sesión.");
            return;
          }
          if (audioPlayer.paused) {
            socket.emit("playSong", { sessionId: currentSessionId });
          } else {
            socket.emit("pauseSong", { sessionId: currentSessionId });
          }
        });

        nextSongBtn.addEventListener("click", () => {
          if (!currentSessionId) {
            showMessage("Primero debes crear o unirte a una sesión.");
            return;
          }
          socket.emit("nextSong", { sessionId: currentSessionId });
        });

        checkWinnersBtn.addEventListener("click", () => {
          if (!currentSessionId) {
            showMessage("Primero debes crear o unirte a una sesión.");
            return;
          }
          socket.emit("checkWinners", { sessionId: currentSessionId });
        });

        socket.on("songUpdate", ({ previewUrl, songTitle, isPlaying }) => {
          currentSongInfo.textContent = songTitle || "Ninguna";
          if (previewUrl) {
            audioPlayer.src = previewUrl;
            audioPlayer.classList.remove("hidden");
            if (isPlaying) {
              audioPlayer
                .play()
                .catch((e) => console.error("Error al reproducir audio:", e));
              playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
              playPauseBtn.classList.remove("btn-green");
              playPauseBtn.classList.add("btn");
            } else {
              audioPlayer.pause();
              playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar';
              playPauseBtn.classList.remove("btn");
              playPauseBtn.classList.add("btn-green");
            }
          } else {
            audioPlayer.pause();
            audioPlayer.src = "";
            audioPlayer.classList.add("hidden");
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar';
            playPauseBtn.classList.remove("btn");
            playPauseBtn.classList.add("btn-green");
          }
        });

        socket.on("winnersFound", ({ winners }) => {
          if (winners.length > 0) {
            winnerDisplay.textContent = `¡Ganador(es) de BINGO: ${winners.join(
              ", "
            )}!`;
            showMessage(
              `¡BINGO! Ganador(es): ${winners.join(", ")}`,
              "success"
            );
          } else {
            winnerDisplay.textContent = "Aún no hay ganadores de BINGO.";
            showMessage("Aún no hay ganadores de BINGO.", "info");
          }
        });

        // --- Lógica de Jugador ---
        joinSessionBtn.addEventListener("click", () => {
          const sid = joinSessionIdInput.value.trim();
          if (sid) {
            // Generar un ID de usuario único para este jugador
            userId = "player_" + Math.random().toString(36).substring(2, 9);
            showMessage(`Uniéndote a la sesión ${sid}...`, "info");
            socket.emit("joinSession", { sessionId: sid, userId: userId });
          } else {
            showMessage("Por favor, introduce un ID de sesión.");
          }
        });

        socket.on(
          "sessionJoined",
          ({ sessionId, bingoCard, currentTrack, isPlaying }) => {
            currentSessionId = sessionId;
            currentBingoCard = bingoCard;
            markedSongs.clear(); // Limpia canciones marcadas previamente para la nueva sesión
            winMessageDiv.classList.add("hidden"); // Oculta el mensaje de victoria en la nueva sesión

            document
              .getElementById("join-session-section")
              .classList.add("hidden");
            gameAreaDiv.classList.remove("hidden");
            showMessage(
              `Te has unido a la sesión ${sessionId}. ¡Que empiece el juego!`,
              "success"
            );

            renderBingoCard(bingoCard);
            updatePlayerStats();
            // Actualiza el estado inicial de la canción para nuevos jugadores
            socket.emit("requestCurrentSong", { sessionId: currentSessionId });
            socket.emit("requestPlayerState", {
              sessionId: currentSessionId,
              userId: userId,
            });
          }
        );

        socket.on(
          "updateBingoCard",
          ({ markedCells, linesCompleted, isBingo, userId: updatedUserId }) => {
            if (updatedUserId === userId) {
              // Solo actualiza si es para este jugador
              markedSongs = new Set(markedCells);
              renderBingoCard(currentBingoCard); // Vuelve a renderizar para actualizar el estado marcado
              updatePlayerStats();

              if (isBingo) {
                winMessageDiv.classList.remove("hidden");
                showMessage("¡BINGO! Has ganado.", "success");
              } else {
                winMessageDiv.classList.add("hidden");
              }
            }
          }
        );

        socket.on(
          "currentSongState",
          ({ previewUrl, songTitle, isPlaying }) => {
            // Los jugadores no reproducen audio, pero necesitan saber qué canción está "activa" para marcar
            // El reproductor de audio del admin se maneja con el evento songUpdate.
            // Este evento es principalmente para que los nuevos jugadores se sincronicen.
            console.log(
              "Estado de la canción actual recibido por el jugador:",
              songTitle,
              "está sonando:",
              isPlaying
            );
          }
        );

        // Maneja el estado del jugador para los jugadores recién unidos
        socket.on(
          "playerState",
          ({ markedSongs: playerMarkedSongs, linesCompleted, isBingo }) => {
            markedSongs = new Set(playerMarkedSongs);
            renderBingoCard(currentBingoCard);
            updatePlayerStats();
            if (isBingo) {
              winMessageDiv.classList.remove("hidden");
            } else {
              winMessageDiv.classList.add("hidden");
            }
          }
        );

        function renderBingoCard(card) {
          bingoCardDiv.innerHTML = "";
          card.forEach((song) => {
            const cell = document.createElement("div");
            cell.classList.add("bingo-cell", "rounded-lg", "shadow-md");
            if (markedSongs.has(song.id)) {
              cell.classList.add("marked");
            }
            cell.dataset.songId = song.id;
            cell.innerHTML = `
                        <p class="font-bold">${song.title}</p>
                        <p class="text-sm">${song.artist}</p>
                    `;
            cell.addEventListener("click", () => {
              if (!currentSessionId) {
                showMessage("No estás en una sesión activa.");
                return;
              }
              if (cell.classList.contains("marked")) {
                showMessage("Esta canción ya está marcada.");
                return;
              }
              // Informa al servidor sobre el clic
              socket.emit("markSong", {
                sessionId: currentSessionId,
                userId: userId,
                songId: song.id,
              });
            });
            bingoCardDiv.appendChild(cell);
          });
        }

        function updatePlayerStats() {
          markedCountSpan.textContent = markedSongs.size;

          // Calcula líneas (solo comprobación horizontal por ahora)
          let lines = 0;
          const size = 5; // Cartón de bingo 5x5
          const cardArray = Array.from(currentBingoCard); // Convierte Set a Array si es necesario

          // Ayuda para comprobar si un conjunto de índices están todos marcados
          const areAllMarked = (indices) => {
            return indices.every((index) =>
              markedSongs.has(cardArray[index].id)
            );
          };

          // Comprobar líneas horizontales
          for (let i = 0; i < size; i++) {
            const rowIndices = Array.from(
              { length: size },
              (_, j) => i * size + j
            );
            if (areAllMarked(rowIndices)) {
              lines++;
            }
          }

          // Comprobar líneas verticales
          for (let j = 0; j < size; j++) {
            const colIndices = Array.from(
              { length: size },
              (_, i) => i * size + j
            );
            if (areAllMarked(colIndices)) {
              lines++;
            }
          }

          // Comprobar diagonal 1 (arriba-izquierda a abajo-derecha)
          const diag1Indices = Array.from(
            { length: size },
            (_, i) => i * size + i
          );
          if (areAllMarked(diag1Indices)) {
            lines++;
          }

          // Comprobar diagonal 2 (arriba-derecha a abajo-izquierda)
          const diag2Indices = Array.from(
            { length: size },
            (_, i) => i * size + (size - 1 - i)
          );
          if (areAllMarked(diag2Indices)) {
            lines++;
          }

          linesCountSpan.textContent = lines;
        }
      }); 