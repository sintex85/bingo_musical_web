import os
import re
import json
import asyncio
import random
import string
from aiohttp import web
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# In-memory sessions
sessions = {}

# Spotify API setup
client_id = os.getenv('SPOTIFY_CLIENT_ID')
client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
if client_id and client_secret:
    auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)
    spotify = spotipy.Spotify(auth_manager=auth_manager)
else:
    spotify = None

async def get_playlist_tracks(url):
    """Fetch all tracks from a Spotify playlist."""
    if not spotify:
        raise RuntimeError('Spotify credentials not configured')
    match = re.search(r'playlist/([^?]+)', url)
    if not match:
        raise ValueError('Invalid playlist URL')
    playlist_id = match.group(1)

    def fetch():
        results = spotify.playlist_items(playlist_id, additional_types=['track'], limit=100)
        items = results['items']
        while results['next']:
            results = spotify.next(results)
            items.extend(results['items'])
        tracks = []
        for item in items:
            t = item['track']
            tracks.append({
                'name': t['name'],
                'artist': ', '.join(a['name'] for a in t['artists']),
                'preview': t['preview_url'],
            })
        return tracks

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fetch)

async def create_session(request):
    data = await request.json()
    playlist_url = data.get('playlistUrl')
    try:
        songs = await get_playlist_tracks(playlist_url)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=400)

    session_id = ''.join(random.choice('0123456789abcdef') for _ in range(8))
    sessions[session_id] = {
        'songs': songs,
        'players': {},
        'admin': None,
        'current': -1
    }
    return web.json_response({'id': session_id})

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    session_id = None
    role = None

    async for msg in ws:
        if msg.type == web.WSMsgType.TEXT:
            data = json.loads(msg.data)
            if data['type'] == 'join':
                session_id = data['sessionId']
                role = data['role']
                session = sessions.get(session_id)
                if not session:
                    await ws.close()
                    break
                if role == 'admin':
                    session['admin'] = ws
                else:
                    card = shuffle(session['songs'])[:25]
                    session['players'][ws] = {'card': card, 'marked': []}
                    await ws.send_json({'type': 'card', 'card': card})
            elif data['type'] == 'mark' and role == 'player':
                session = sessions.get(session_id)
                if not session:
                    continue
                player = session['players'].get(ws)
                if player is None:
                    continue
                player['marked'] = data['marked']
                if len(player['marked']) >= 20 and not player.get('reported'):
                    player['reported'] = True
                    if session.get('admin'):
                        idx = list(session['players'].keys()).index(ws) + 1
                        await session['admin'].send_json({'type': 'bingo', 'player': idx})
            elif data['type'] == 'next' and role == 'admin':
                session = sessions.get(session_id)
                if not session:
                    continue
                session['current'] += 1
                song = session['songs'][session['current']]
                for pws in list(session['players'].keys()):
                    await pws.send_json({'type': 'play', 'index': session['current'], 'song': song})

    if session_id:
        session = sessions.get(session_id)
        if session:
            if role == 'admin':
                session['admin'] = None
            else:
                session['players'].pop(ws, None)

    return ws

def shuffle(lst):
    items = lst[:]
    random.shuffle(items)
    return items

app = web.Application()
app.router.add_post('/create', create_session)
app.router.add_get('/ws', websocket_handler)
app.router.add_get('/', lambda r: web.FileResponse('public/index.html'))
app.router.add_get('/player.html', lambda r: web.FileResponse('public/player.html'))
app.router.add_static('/css/', path='public/css')
app.router.add_static('/js/', path='public/js')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3333))
    web.run_app(app, port=port)
