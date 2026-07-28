const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const SILVER = 0x8a9bb0;

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '??:??';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function progressBar(elapsed, total, len = 16) {
  if (!total || isNaN(total)) return '▬'.repeat(len);
  const pct = Math.min(elapsed / total, 1);
  const filled = Math.round(pct * len);
  return '▬'.repeat(filled) + '🔘' + '▬'.repeat(len - filled);
}

function buildNowPlayingEmbed(track, player) {
  const elapsed  = player.getElapsed();
  const duration = track.duration || 0;
  const loopIcon = player.loop === 'track' ? '🔁 أغنية'
                 : player.loop === 'queue'  ? '🔄 طابور' : '➡️ لا';
  const volPct = Math.round((player.volume / 130) * 100);

  const embed = new EmbedBuilder()
    .setColor(SILVER)
    .setAuthor({ name: 'Lś | Music' })
    .setTitle(`🎵  ${track.title}`)
    .setURL(track.url)
    .setDescription(
      `\`${fmtTime(elapsed)}\` ${progressBar(elapsed, duration)} \`${fmtTime(duration)}\``
    )
    .addFields(
      { name: '🔊 الصوت',   value: `${player.volume}/130 (${volPct}%)`, inline: true },
      { name: '🔁 التكرار', value: loopIcon,                             inline: true },
      { name: '📋 الطابور', value: `${player.queue.length} أغنية`,        inline: true },
    )
    .setFooter({ text: `طُلبت بواسطة ${track.requestedBy}` })
    .setTimestamp();

  if (track.thumbnail) embed.setImage(track.thumbnail);
  return embed;
}

function buildButtons(player) {
  const isPaused  = player.isPaused;
  const loopActive = player.loop !== 'none';

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setEmoji('⏮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pause').setEmoji(isPaused ? '▶️' : '⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skip').setEmoji('⏭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('loop').setEmoji('🔁').setStyle(loopActive ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vol_down').setLabel('🔉 صوت -').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vol_up').setLabel('🔊 صوت +').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('queue_list').setLabel('📋 الطابور').setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

function buildQueueEmbed(queue, currentTrack) {
  const embed = new EmbedBuilder()
    .setColor(SILVER)
    .setAuthor({ name: 'Lś | Music — الطابور' })
    .setTitle('📋 قائمة الأغاني');

  if (!currentTrack) {
    embed.setDescription('لا يوجد شيء يعزف الآن.');
    return embed;
  }

  const lines = [`**الآن:** 🎵 ${currentTrack.title}`];
  if (queue.length === 0) {
    lines.push('\nالطابور فارغ');
  } else {
    queue.slice(0, 15).forEach((t, i) => {
      lines.push(`\`${i + 1}.\` ${t.title} — ${fmtTime(t.duration)}`);
    });
    if (queue.length > 15) lines.push(`\n...و ${queue.length - 15} أغنية أخرى`);
  }

  embed.setDescription(lines.join('\n'));
  return embed;
}

function buildInfoEmbed(message, color = SILVER) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'Lś | Music' })
    .setDescription(message)
    .setTimestamp();
}

module.exports = {
  buildNowPlayingEmbed,
  buildButtons,
  buildQueueEmbed,
  buildInfoEmbed,
  fmtTime,
  SILVER,
};
