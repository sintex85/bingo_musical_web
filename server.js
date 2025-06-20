

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
    // In many shared‑hosting setups Apache no permite WebSocket (proxy_wstunnel deshabilitado).
    // En producción sólo usaremos long‑polling; en local mantenemos ambos transportes.
    transports: process.env.NODE_ENV === 'production'
        ? ["polling"]
        : ["polling", "websocket"],
    // Desactivamos la entrega del cliente integrado de Socket.IO;
    // en producción lo cargamos desde CDN para evitar que Apache lo sirva mal.
    serveClient: false
});

const PORT = process.env.PORT || 3000;
// ---- DEBUG BOOT ----
console.log('[BOOT] NODE_ENV:', process.env.NODE_ENV);
// --------------------

// Spotify API credentials from environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
console.log('[BOOT] SPOTIFY_CLIENT_ID present:', !!SPOTIFY_CLIENT_ID);

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
//                 bingoCard: [{ id: string, title: string, artist: string }] // 20 songs for this player
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
        console.log('[STEP-2] Requesting Spotify token');
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
        console.log('[STEP-3] Spotify token OK');
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

    let currentSessionId = null;

    socket.on('createSession', async ({ playlistUrl }) => {
        console.log('[STEP-1] createSession recibido');
        const playlistId = getPlaylistIdFromUrl(playlistUrl);
        if (!playlistId) {
            socket.emit('sessionError', 'URL de playlist de Spotify no válida. Asegúrate de que sea un enlace a una playlist pública.');
            return;
        }
        try {
            const allSongs = await getPlaylistTracks(playlistId);
            console.log('[STEP-4] Canciones obtenidas:', allSongs.length);
            if (allSongs.length < 20) {
                socket.emit('sessionError', `La playlist debe tener al menos 20 canciones. Solo se encontraron ${allSongs.length}.`);
                return;
            }
            const sessionId = Math.random().toString(36).substring(2, 9); // Generate a simple unique ID
            currentSessionId = sessionId; // Set current session for this admin socket
            sessions[sessionId] = {
                adminSocketId: socket.id,
                playlistUrl,
                songs: allSongs,
                currentSongIndex: -1,
                isPlaying: false,
                players: {},
                adminAudioPlayer: null
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
        if (!sessions[sessionId]) {
            socket.emit('sessionError', 'ID de sesión no válido o sesión no encontrada.');
            return;
        }
        currentSessionId = sessionId;
        // If player already joined with this userId (e.g., refresh), update socketId
        if (sessions[sessionId].players[userId]) {
            sessions[sessionId].players[userId].socketId = socket.id;
            console.log(`Player ${userId} reconnected to session ${sessionId}`);
            socket.emit('sessionJoined', {
                sessionId,
                bingoCard: sessions[sessionId].players[userId].bingoCard,
            });
        } else {
            // New player
            const availableSongs = shuffleArray([...sessions[sessionId].songs]);
            const bingoCard = availableSongs.slice(0, 20);
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
        socket.join(sessionId);
    });

    // All other handlers removed as per instructions.
});

server.listen(PORT, () => {
    console.log(`PUBLIC_URL loaded from .env: ${process.env.PUBLIC_URL}`);
    console.log(`Server is running on ${(process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '')}`);
});