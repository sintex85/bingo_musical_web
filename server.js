

// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"]
});

const PORT = process.env.PORT || 3000;

// Spotify API credentials from environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let spotifyAccessToken = '';
let tokenExpiryTime = 0;

// In-memory storage for game sessions
// Structure:
// sessions = {
//     sessionId: {
//         adminSocketId: string,
//         playlistUrl: string,
//         songs: [{ id: string, title: string, artist: string, previewUrl: string }],
//         currentSongIndex: number,
//         isPlaying: boolean,
//         players: {
//             userId: {
//                 socketId: string,
//                 markedSongs: Set<string>, // Set of song IDs marked by this player
//                 linesCompleted: number,
//                 isBingo: boolean,
//                 bingoCard: [{ id: string, title: string, artist: string }] // 25 songs for this player
//             }
//         },
//         adminAudioPlayer: null | NodeJS.Timeout // Timeout for 30s preview
//     }
// }
const sessions = {};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for client‑side routing, but ignore Socket.IO and asset requests
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
        // Let Socket.IO or subsequent middleware handle it
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to get Spotify access token
async function getSpotifyAccessToken() {
    if (spotifyAccessToken && Date.now() < tokenExpiryTime) {
        return spotifyAccessToken; // Token is still valid
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'client_credentials'
            }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
                }
            });
        spotifyAccessToken = response.data.access_token;
        tokenExpiryTime = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute to refresh proactively
        console.log('Spotify access token obtained.');
        return spotifyAccessToken;
    } catch (error) {
        console.error('Error getting Spotify access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get Spotify access token.');
    }
}

// Function to extract playlist ID from URL
function getPlaylistIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'open.spotify.com' || urlObj.hostname === 'spotify.com') {
            const pathSegments = urlObj.pathname.split('/');
            const playlistIndex = pathSegments.indexOf('playlist');
            if (playlistIndex !== -1 && pathSegments.length > playlistIndex + 1) {
                // Playlist ID is usually after /playlist/ and before any query params
                return pathSegments[playlistIndex + 1].split('?')[0];
            }
        }
        return null;
    } catch (e) {
        console.error("Invalid URL format:", url, e);
        return null;
    }
}

// Function to fetch playlist tracks from Spotify API
async function getPlaylistTracks(playlistId) {
    const accessToken = await getSpotifyAccessToken();
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

    while (nextUrl) {
        try {
            const response = await axios.get(nextUrl, {
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                }
            });

            const items = response.data.items;
            items.forEach(item => {
                if (item.track) { // Ensure it's a track (not a local track etc.)
                    tracks.push({
                        id: item.track.id,
                        title: item.track.name,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        previewUrl: item.track.preview_url // 30-second preview URL
                    });
                }
            });
            nextUrl = response.data.next; // For pagination
        } catch (error) {
            console.error('Error fetching playlist tracks:', error.response ? error.response.data : error.message);
            throw new Error('Failed to fetch playlist tracks from Spotify.');
        }
    }
    return tracks;
}

// Helper to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to calculate lines and bingo
function calculateBingoState(bingoCard, markedSongs) {
    const size = 5;
    let lines = 0;
    let markedCount = markedSongs.size;

    const cardSongIds = bingoCard.map(song => song.id);

    // Helper to check if a set of indices are all marked
    const areAllMarked = (indices) => {
        return indices.every(index => markedSongs.has(cardSongIds[index]));
    };

    // Check horizontal lines
    for (let i = 0; i < size; i++) {
        const rowIndices = Array.from({ length: size }, (_, j) => i * size + j);
        if (areAllMarked(rowIndices)) {
            lines++;
        }
    }

    // Check vertical lines
    for (let j = 0; j < size; j++) {
        const colIndices = Array.from({ length: size }, (_, i) => i * size + j);
        if (areAllMarked(colIndices)) {
            lines++;
        }
    }

    // Check diagonal 1 (top-left to bottom-right)
    const diag1Indices = Array.from({ length: size }, (_, i) => i * size + i);
    if (areAllMarked(diag1Indices)) {
        lines++;
    }

    // Check diagonal 2 (top-right to bottom-left)
    const diag2Indices = Array.from({ length: size }, (_, i) => i * size + (size - 1 - i));
    if (areAllMarked(diag2Indices)) {
        lines++;
    }

    // A bingo is defined as marking 20 songs in total
    const isBingo = markedCount >= 20;

    return { linesCompleted: lines, isBingo };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    let userRole = null; // 'admin' or 'player'
    let currentSessionId = null;
    let currentUserId = null; // Unique ID for player (client-generated)

    socket.on('setRole', ({ role }) => {
        userRole = role;
        console.log(`${socket.id} set role as: ${role}`);
    });

    socket.on('createSession', async ({ playlistUrl }) => {
        console.log(`[createSession] Role: ${userRole}, Socket: ${socket.id}, URL: ${playlistUrl}`);
        if (userRole !== 'admin') {
            socket.emit('sessionError', 'Solo los administradores pueden crear sesiones.');
            return;
        }

        const playlistId = getPlaylistIdFromUrl(playlistUrl);
        if (!playlistId) {
            socket.emit('sessionError', 'URL de playlist de Spotify no válida. Asegúrate de que sea un enlace a una playlist pública.');
            return;
        }

        try {
            const allSongs = await getPlaylistTracks(playlistId);
            if (allSongs.length < 25) {
                socket.emit('sessionError', `La playlist debe tener al menos 25 canciones. Solo se encontraron ${allSongs.length}.`);
                return;
            }

            const sessionId = Math.random().toString(36).substring(2, 9); // Generate a simple unique ID
            currentSessionId = sessionId; // Set current session for this admin socket

            sessions[sessionId] = {
                adminSocketId: socket.id,
                playlistUrl,
                songs: allSongs,
                currentSongIndex: -1, // No song playing initially
                isPlaying: false,
                players: {},
                adminAudioPlayer: null // To store the timeout for 30s preview
            };

            const joinUrl = `${(process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '')}?sid=${sessionId}`;
            socket.emit('sessionCreated', { sessionId, joinUrl });
            console.log(`Session ${sessionId} created by admin ${socket.id}`);
        } catch (error) {
            console.error('Error creating session:', error);
            socket.emit('sessionError', `Error al crear la sesión: ${error.message}`);
        }
    });

    socket.on('joinSession', ({ sessionId, userId }) => {
        if (userRole !== 'player') {
            socket.emit('sessionError', 'Solo los jugadores pueden unirse a sesiones.');
            return;
        }
        if (!sessions[sessionId]) {
            socket.emit('sessionError', 'ID de sesión no válido o sesión no encontrada.');
            return;
        }

        currentSessionId = sessionId;
        currentUserId = userId;

        // If player already joined with this userId (e.g., refresh), update socketId
        if (sessions[sessionId].players[userId]) {
            sessions[sessionId].players[userId].socketId = socket.id;
            console.log(`Player ${userId} reconnected to session ${sessionId}`);
            // Re-send existing bingo card and state
            socket.emit('sessionJoined', {
                sessionId,
                bingoCard: sessions[sessionId].players[userId].bingoCard,
            });
            socket.emit('playerState', {
                markedSongs: Array.from(sessions[sessionId].players[userId].markedSongs),
                linesCompleted: sessions[sessionId].players[userId].linesCompleted,
                isBingo: sessions[sessionId].players[userId].isBingo
            });
        } else {
            // New player
            const availableSongs = shuffleArray([...sessions[sessionId].songs]); // Shuffle all songs
            const bingoCard = availableSongs.slice(0, 25); // Take first 25 for the card

            sessions[sessionId].players[userId] = {
                socketId: socket.id,
                markedSongs: new Set(),
                linesCompleted: 0,
                isBingo: false,
                bingoCard: bingoCard
            };
            console.log(`Player ${userId} joined session ${sessionId}`);
            socket.emit('sessionJoined', { sessionId, bingoCard });
        }
        socket.join(sessionId); // Join a Socket.IO room for this session
    });

    socket.on('playSong', ({ sessionId }) => {
        const session = sessions[sessionId];
        if (!session || session.adminSocketId !== socket.id) {
            socket.emit('sessionError', 'No autorizado para controlar esta sesión.');
            return;
        }

        if (session.songs.length === 0) {
            socket.emit('sessionError', 'No hay canciones en la playlist para reproducir.');
            return;
        }

        if (session.currentSongIndex === -1) {
            // Start from the beginning if not started yet or reset
            session.currentSongIndex = 0;
        }

        session.isPlaying = true;
        const currentSong = session.songs[session.currentSongIndex];

        // Clear previous timeout if exists
        if (session.adminAudioPlayer) {
            clearTimeout(session.adminAudioPlayer);
        }
        // Set a timeout for 30 seconds (Spotify preview duration)
        if (currentSong.previewUrl) {
             session.adminAudioPlayer = setTimeout(() => {
                // Auto-advance to next song after 30 seconds if still playing
                console.log(`30-second preview for ${currentSong.title} ended. Auto-advancing.`);
                // Reset isPlaying to false so admin can manually play next or start again
                session.isPlaying = false; // Pause when preview ends
                io.to(sessionId).emit('songUpdate', {
                    previewUrl: currentSong.previewUrl,
                    songTitle: currentSong.title + ' - ' + currentSong.artist,
                    isPlaying: false
                });
                // Optionally, automatically go to the next song here:
                // socket.emit('nextSong', { sessionId });
            }, 30 * 1000); // 30 seconds
        }


        // Emit song update to all clients in the session room (including admin)
        io.to(sessionId).emit('songUpdate', {
            previewUrl: currentSong.previewUrl,
            songTitle: currentSong.title + ' - ' + currentSong.artist,
            isPlaying: session.isPlaying
        });
        console.log(`Admin ${socket.id} playing song ${session.currentSongIndex} in session ${sessionId}`);
    });

    socket.on('pauseSong', ({ sessionId }) => {
        const session = sessions[sessionId];
        if (!session || session.adminSocketId !== socket.id) {
            socket.emit('sessionError', 'No autorizado para controlar esta sesión.');
            return;
        }

        session.isPlaying = false;
        if (session.adminAudioPlayer) {
            clearTimeout(session.adminAudioPlayer);
            session.adminAudioPlayer = null;
        }

        const currentSong = session.songs[session.currentSongIndex];
        io.to(sessionId).emit('songUpdate', {
            previewUrl: currentSong ? currentSong.previewUrl : null,
            songTitle: currentSong ? currentSong.title + ' - ' + currentSong.artist : 'Ninguna',
            isPlaying: session.isPlaying
        });
        console.log(`Admin ${socket.id} paused song in session ${sessionId}`);
    });


    socket.on('nextSong', ({ sessionId }) => {
        const session = sessions[sessionId];
        if (!session || session.adminSocketId !== socket.id) {
            socket.emit('sessionError', 'No autorizado para controlar esta sesión.');
            return;
        }

        if (session.adminAudioPlayer) {
            clearTimeout(session.adminAudioPlayer);
            session.adminAudioPlayer = null;
        }

        session.currentSongIndex = (session.currentSongIndex + 1) % session.songs.length;
        session.isPlaying = true; // Auto-play next song
        const currentSong = session.songs[session.currentSongIndex];

        if (currentSong.previewUrl) {
            session.adminAudioPlayer = setTimeout(() => {
                session.isPlaying = false;
                 io.to(sessionId).emit('songUpdate', {
                    previewUrl: currentSong.previewUrl,
                    songTitle: currentSong.title + ' - ' + currentSong.artist,
                    isPlaying: false
                });
            }, 30 * 1000);
        }


        io.to(sessionId).emit('songUpdate', {
            previewUrl: currentSong.previewUrl,
            songTitle: currentSong.title + ' - ' + currentSong.artist,
            isPlaying: session.isPlaying
        });
        console.log(`Admin ${socket.id} advanced to song ${session.currentSongIndex} in session ${sessionId}`);
    });

    socket.on('markSong', ({ sessionId, userId, songId }) => {
        const session = sessions[sessionId];
        if (!session || !session.players[userId] || session.players[userId].socketId !== socket.id) {
            socket.emit('sessionError', 'No autorizado para marcar canciones en esta sesión.');
            return;
        }

        const player = session.players[userId];
        const currentPlayingSong = session.songs[session.currentSongIndex];

        // Check if the marked song matches the currently playing song
        if (currentPlayingSong && currentPlayingSong.id === songId) {
            if (!player.markedSongs.has(songId)) {
                player.markedSongs.add(songId);
                const { linesCompleted, isBingo } = calculateBingoState(player.bingoCard, player.markedSongs);
                player.linesCompleted = linesCompleted;
                player.isBingo = isBingo;

                // Send update specifically to the player who marked the song
                socket.emit('updateBingoCard', {
                    markedCells: Array.from(player.markedSongs),
                    linesCompleted: player.linesCompleted,
                    isBingo: player.isBingo,
                    userId: userId // Echo back userId for client-side filtering
                });
                console.log(`Player ${userId} marked song ${songId} in session ${sessionId}. Marked: ${player.markedSongs.size}, Bingo: ${player.isBingo}`);
            } else {
                // Song already marked, inform player
                socket.emit('sessionError', 'Esta canción ya está marcada en tu cartón.');
            }
        } else {
            socket.emit('sessionError', 'No puedes marcar esta canción ahora. Solo puedes marcar la canción que está sonando.');
        }
    });

    socket.on('checkWinners', ({ sessionId }) => {
        const session = sessions[sessionId];
        if (!session || session.adminSocketId !== socket.id) {
            socket.emit('sessionError', 'No autorizado para verificar ganadores.');
            return;
        }

        const bingoWinners = [];
        for (const userId in session.players) {
            if (session.players[userId].isBingo) {
                bingoWinners.push(userId);
            }
        }
        io.to(sessionId).emit('winnersFound', { winners: bingoWinners });
        console.log(`Winners checked for session ${sessionId}: ${bingoWinners.length ? bingoWinners.join(', ') : 'None'}`);
    });

    socket.on('requestCurrentSong', ({ sessionId }) => {
        const session = sessions[sessionId];
        if (session) {
            const currentSong = session.songs[session.currentSongIndex];
            socket.emit('currentSongState', {
                previewUrl: currentSong ? currentSong.previewUrl : null,
                songTitle: currentSong ? currentSong.title + ' - ' + currentSong.artist : 'Ninguna',
                isPlaying: session.isPlaying
            });
        }
    });

    socket.on('requestPlayerState', ({ sessionId, userId }) => {
        const session = sessions[sessionId];
        if (session && session.players[userId]) {
            const player = session.players[userId];
            socket.emit('playerState', {
                markedSongs: Array.from(player.markedSongs),
                linesCompleted: player.linesCompleted,
                isBingo: player.isBingo
            });
        }
    });


    socket.on('disconnect', () => {
        console.log(`User connected: ${socket.id}`);
        // Clean up session if admin disconnects
        if (userRole === 'admin' && currentSessionId && sessions[currentSessionId] && sessions[currentSessionId].adminSocketId === socket.id) {
            console.log(`Admin ${socket.id} disconnected. Closing session ${currentSessionId}.`);
            if (sessions[currentSessionId].adminAudioPlayer) {
                clearTimeout(sessions[currentSessionId].adminAudioPlayer);
            }
            // Notify players in the session that the admin has left (optional)
            io.to(currentSessionId).emit('sessionEnded', 'El administrador ha desconectado. La sesión ha terminado.');
            delete sessions[currentSessionId];
        }
        // If a player disconnects, their state remains, but their socketId needs to be updated if they rejoin
        // No immediate deletion of player state needed, as they might reconnect.
        if (userRole === 'player' && currentSessionId && currentUserId && sessions[currentSessionId] && sessions[currentSessionId].players[currentUserId]) {
             // Just update the socketId to null or a placeholder to indicate disconnect
             // For simplicity, we'll let their state persist until an admin explicitly cleans up or session ends.
             // If a player disconnects and reconnects with the same userId, their socketId will be updated.
             sessions[currentSessionId].players[currentUserId].socketId = null; // Mark as disconnected
             console.log(`Player ${currentUserId} disconnected from session ${currentSessionId}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`PUBLIC_URL loaded from .env: ${process.env.PUBLIC_URL}`);
    console.log(`Server is running on ${(process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '')}`);
});