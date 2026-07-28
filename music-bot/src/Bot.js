const { Client, GatewayIntentBits, Partials } = require('discord.js');
const MusicPlayer = require('./MusicPlayer');
const { buildNowPlayingEmbed, buildButtons, buildQueueEmbed, buildInfoEmbed, SILVER } = require('./embed');
const { maxVolume } = require('./config');

class Bot {
  constructor({ token, textChannelId, index }) {
    this.token         = token;
    this.textChannelId = textChannelId;
    this.index         = index;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Message, Partials.Channel],
    });
    this.player            = new MusicPlayer(this);
    this.nowPlayingMessage = null;
    this._updateInterval   = null;
    this._bindEvents();
  }

  _bindEvents() {
    this.client.once('ready', () => {
      console.log(`[Bot #${this.index}] ✅ ${this.client.user.tag}`);
      this.client.user.setActivity('🎵 Lś | Music', { type: 2 });
    });
    this.client.on('messageCreate', async (msg) => {
      if (msg.channelId !== this.textChannelId || msg.author.bot) return;
      try { await this._handleMessage(msg); }
      catch (err) { this._reply(msg.channel, buildInfoEmbed(`❌ ${err.message}`, 0xff4444)); }
    });
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      try { await this._handleButton(interaction); }
      catch (err) { await interaction.reply({ embeds: [buildInfoEmbed(`❌ ${err.message}`, 0xff4444)], ephemeral: true }); }
    });
  }

  async _handleMessage(msg) {
    const content = msg.content.trim();

    if (content.startsWith('ش')) {
      const query = content.slice(1).trim();
      if (!query) return this._reply(msg.channel, buildInfoEmbed('📝 مثال: `ش blinding lights`'));
      const vc = msg.member?.voice?.channel;
      if (!vc) return this._reply(msg.channel, buildInfoEmbed('❌ يجب أن تكون في روم صوتية'));
      const loading = await msg.channel.send({ embeds: [buildInfoEmbed('🔍 يبحث...')] });
      try {
        const tracks = await this.player.play(query, msg.author.username, vc);
        await loading.delete().catch(() => {});
        if (tracks.length > 1) await this._reply(msg.channel, buildInfoEmbed(`✅ تمت إضافة **${tracks.length}** أغنية للطابور`));
        await this.updateNowPlayingMessage();
      } catch (err) { await loading.delete().catch(() => {}); throw err; }
      return;
    }

    if (content === 'وقف') {
      if (!this.player.currentTrack && this.player.queue.length === 0)
        return this._reply(msg.channel, buildInfoEmbed('⚠️ لا يوجد شيء يعزف'));
      this.player.stop();
      this._clearInterval();
      if (this.nowPlayingMessage) { await this.nowPlayingMessage.delete().catch(() => {}); this.nowPlayingMessage = null; }
      return this._reply(msg.channel, buildInfoEmbed('⏹️ تم إيقاف الموسيقى'));
    }

    if (content === 'س') {
      if (!this.player.currentTrack) return this._reply(msg.channel, buildInfoEmbed('⚠️ لا يوجد شيء يعزف'));
      this.player.skip();
      return this._reply(msg.channel, buildInfoEmbed('⏭️ تم التخطي'));
    }

    if (content.startsWith('صوت')) {
      const num = parseInt(content.slice(3).trim());
      if (isNaN(num) || num < 1) return this._reply(msg.channel, buildInfoEmbed(`📢 مثال: \`صوت 80\` (1-${maxVolume})`));
      const vol = this.player.setVolume(num);
      return this._reply(msg.channel, buildInfoEmbed(`🔊 الصوت: **${vol}/${maxVolume}**`));
    }

    if (content.startsWith('قدم')) {
      const num = parseInt(content.slice(3).trim());
      if (isNaN(num) || num < 1) return this._reply(msg.channel, buildInfoEmbed('⏩ مثال: `قدم 10`'));
      if (!this.player.currentTrack) return this._reply(msg.channel, buildInfoEmbed('⚠️ لا يوجد شيء يعزف'));
      await this.player.seekForward(num);
      await this.updateNowPlayingMessage();
      return this._reply(msg.channel, buildInfoEmbed(`⏩ تم التقديم **${num}** ثانية`));
    }

    if (content === 'مساعدة' || content === '؟') {
      const { EmbedBuilder } = require('discord.js');
      return this._reply(msg.channel, new EmbedBuilder()
        .setColor(SILVER)
        .setAuthor({ name: 'Lś | Music — المساعدة' })
        .addFields(
          { name: '`ش [اسم أو رابط]`', value: '▶️ تشغيل',         inline: false },
          { name: '`وقف`',             value: '⏹️ إيقاف كامل',    inline: false },
          { name: '`س`',               value: '⏭️ تخطي',          inline: false },
          { name: '`صوت [1-130]`',     value: '🔊 ضبط الصوت',     inline: false },
          { name: '`قدم [ثواني]`',     value: '⏩ تقديم المقطع',   inline: false },
          { name: 'الأزرار',            value: '⏮ ⏸ ⏭ 🔁 ⏹️ | 🔉 🔊 📋', inline: false },
        ));
    }
  }

  async _handleButton(interaction) {
    if (!this.nowPlayingMessage || interaction.message.id !== this.nowPlayingMessage.id)
      return interaction.reply({ embeds: [buildInfoEmbed('⚠️ بوتن غير صالح')], ephemeral: true });
    await interaction.deferUpdate();
    switch (interaction.customId) {
      case 'skip':       this.player.skip(); break;
      case 'pause':      this.player.togglePause(); await this.updateNowPlayingMessage(); break;
      case 'loop':       this.player.toggleLoop();  await this.updateNowPlayingMessage(); break;
      case 'prev':       await this.player.previous(); await this.updateNowPlayingMessage(); break;
      case 'vol_up':     this.player.setVolume(this.player.volume + 10); await this.updateNowPlayingMessage(); break;
      case 'vol_down':   this.player.setVolume(this.player.volume - 10); await this.updateNowPlayingMessage(); break;
      case 'queue_list': await interaction.followUp({ embeds: [buildQueueEmbed(this.player.queue, this.player.currentTrack)], ephemeral: true }); break;
      case 'stop':
        this.player.stop(); this._clearInterval();
        if (this.nowPlayingMessage) { await this.nowPlayingMessage.delete().catch(() => {}); this.nowPlayingMessage = null; }
        break;
    }
  }

  async updateNowPlayingMessage() {
    const channel = await this._getTextChannel();
    if (!channel) return;
    const track = this.player.currentTrack;
    if (!track) {
      if (this.nowPlayingMessage) { await this.nowPlayingMessage.delete().catch(() => {}); this.nowPlayingMessage = null; }
      this._clearInterval();
      return;
    }
    const embed      = buildNowPlayingEmbed(track, this.player);
    const components = buildButtons(this.player);
    if (this.nowPlayingMessage) {
      try { await this.nowPlayingMessage.edit({ embeds: [embed], components }); }
      catch { this.nowPlayingMessage = await channel.send({ embeds: [embed], components }); }
    } else {
      this.nowPlayingMessage = await channel.send({ embeds: [embed], components });
    }
    if (!this._updateInterval) {
      this._updateInterval = setInterval(async () => {
        if (this.player.currentTrack && !this.player.isPaused) await this.updateNowPlayingMessage();
      }, 15_000);
    }
  }

  _clearInterval() {
    if (this._updateInterval) { clearInterval(this._updateInterval); this._updateInterval = null; }
  }

  async _reply(channel, embed) {
    const m = await channel.send({ embeds: [embed] });
    setTimeout(() => m.delete().catch(() => {}), 8_000);
    return m;
  }

  async _getTextChannel() {
    try { return await this.client.channels.fetch(this.textChannelId); }
    catch { return null; }
  }

  async login() {
    if (!this.token) { console.error(`[Bot #${this.index}] ❌ No token! Add BOT_TOKEN_${this.index} to .env`); return; }
    await this.client.login(this.token);
  }
}

module.exports = Bot;
