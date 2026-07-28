const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { maxVolume, defaultVolume } = require('./config');

class MusicPlayer {
  constructor(bot) {
    this.bot          = bot;
    this.queue        = [];
    this.currentTrack = null;
    this.connection   = null;
    this.audioPlayer  = createAudioPlayer();
    this.volume       = defaultVolume;
    this.loop         = 'none';
    this.isPaused     = false;
    this._startedAt   = null;
    this._seekOffset  = 0;
    this._resource    = null;
    this._bindEvents();
  }

  _bindEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this._onTrackEnd());
    this.audioPlayer.on('error', (err) => {
      console.error(`[Player] Error: ${err.message}`);
      this._onTrackEnd();
    });
  }

  async _onTrackEnd() {
    if (this.loop === 'track' && this.currentTrack) {
      await this._playTrack(this.currentTrack);
      return;
    }
    if (this.loop === 'queue' && this.currentTrack) {
      this.queue.push(this.currentTrack);
    }
    if (this.queue.length === 0) {
      this.currentTrack = null;
      this.bot.updateNowPlayingMessage();
      setTimeout(() => this._disconnect(), 5 * 60 * 1000);
      return;
    }
    const next = this.queue.shift();
    await this._playTrack(next);
    this.bot.updateNowPlayingMessage();
  }

  async join(voiceChannel) {
    if (this.connection) { try { this.connection.destroy(); } catch {} }
    this.connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId:        voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf:       true,
    });
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      this.connection.destroy();
      this.connection = null;
      throw new Error('فشل الاتصال بالروم الصوتية');
    }
    this.connection.subscribe(this.audioPlayer);
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch { this._disconnect(); }
    });
  }

  _disconnect() {
    try { this.connection?.destroy(); } catch {}
    this.connection   = null;
    this.queue        = [];
    this.currentTrack = null;
    this.isPaused     = false;
  }

  async _playTrack(track) {
    this.currentTrack = track;
    this._startedAt   = Date.now();
    this._seekOffset  = 0;
    try {
      const stream = await playdl.stream(track.url, {
        quality: 2,
        discordPlayerCompatibility: true,
      });
      this._resource = createAudioResource(stream.stream, {
        inputType:    stream.type,
        inlineVolume: true,
      });
      this._applyVolume();
      this.audioPlayer.play(this._resource);
      this.isPaused = false;
    } catch (err) {
      console.error(`[Player] Stream error: ${err.message}`);
      await this._onTrackEnd();
    }
  }

  _applyVolume() {
    if (this._resource?.volume) {
      this._resource.volume.setVolume(this.volume / 100);
    }
  }

  getElapsed() {
    if (!this._startedAt) return 0;
    return Math.floor((Date.now() - this._startedAt) / 1000) + this._seekOffset;
  }

  async play(query, requester, voiceChannel) {
    if (playdl.is_expired()) await playdl.refreshToken();
    let tracks = [];
    const validated = await playdl.validate(query);

    if (validated === 'yt_video') {
      const info = await playdl.video_info(query);
      tracks.push({ title: info.video_details.title, url: info.video_details.url, duration: info.video_details.durationInSec, thumbnail: info.video_details.thumbnails[0]?.url || null, requestedBy: requester });
    } else if (validated === 'yt_playlist') {
      const pl = await playdl.playlist_info(query, { incomplete: true });
      for (const v of pl.videos.slice(0, 50))
        tracks.push({ title: v.title, url: v.url, duration: v.durationInSec, thumbnail: v.thumbnails[0]?.url || null, requestedBy: requester });
    } else if (validated === 'sp_track') {
      const sp  = await playdl.spotify(query);
      const res = await playdl.search(`${sp.name} ${sp.artists[0]?.name}`, { source: { youtube: 'video' }, limit: 1 });
      if (res.length > 0)
        tracks.push({ title: `${sp.name} — ${sp.artists.map(a => a.name).join(', ')}`, url: res[0].url, duration: Math.floor(sp.durationInMs / 1000), thumbnail: sp.thumbnail?.url || null, requestedBy: requester });
    } else if (validated === 'sp_playlist' || validated === 'sp_album') {
      const sp = await playdl.spotify(query);
      for (const t of sp.tracks.slice(0, 30)) {
        const res = await playdl.search(`${t.name} ${t.artists[0]?.name}`, { source: { youtube: 'video' }, limit: 1 });
        if (res.length > 0)
          tracks.push({ title: `${t.name} — ${t.artists.map(a => a.name).join(', ')}`, url: res[0].url, duration: Math.floor(t.durationInMs / 1000), thumbnail: t.thumbnail?.url || null, requestedBy: requester });
      }
    } else {
      const res = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
      if (res.length === 0) throw new Error('لم يتم العثور على نتائج');
      const v = res[0];
      tracks.push({ title: v.title, url: v.url, duration: v.durationInSec, thumbnail: v.thumbnails[0]?.url || null, requestedBy: requester });
    }

    if (tracks.length === 0) throw new Error('لم يتم العثور على نتائج');
    if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed)
      await this.join(voiceChannel);
    this.queue.push(...tracks);
    if (this.audioPlayer.state.status === AudioPlayerStatus.Idle)
      await this._playTrack(this.queue.shift());
    return tracks;
  }

  stop() {
    this.queue = []; this.loop = 'none';
    this.audioPlayer.stop(true);
    this.currentTrack = null;
    this._disconnect();
  }

  skip() {
    if (!this.currentTrack) return false;
    this.audioPlayer.stop();
    return true;
  }

  setVolume(vol) {
    const clamped = Math.max(1, Math.min(vol, maxVolume));
    this.volume = clamped;
    this._applyVolume();
    return clamped;
  }

  async seekForward(seconds) {
    if (!this.currentTrack) return false;
    const newOffset  = this.getElapsed() + seconds;
    this._seekOffset = newOffset;
    this._startedAt  = Date.now();
    try {
      const stream = await playdl.stream(this.currentTrack.url, { quality: 2, discordPlayerCompatibility: true, seek: newOffset });
      this._resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
      this._applyVolume();
      this.audioPlayer.play(this._resource);
    } catch (err) { console.error(`[Player] Seek error: ${err.message}`); }
    return true;
  }

  togglePause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause(); this.isPaused = false;
    } else {
      this.audioPlayer.pause(); this.isPaused = true;
    }
    return this.isPaused;
  }

  toggleLoop() {
    if (this.loop === 'none')       this.loop = 'track';
    else if (this.loop === 'track') this.loop = 'queue';
    else                            this.loop = 'none';
    return this.loop;
  }

  async previous() {
    if (!this.currentTrack) return false;
    await this._playTrack(this.currentTrack);
    return true;
  }
}

module.exports = MusicPlayer;
