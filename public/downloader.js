
// public/downloader.js
// ESM Version – Browser-only (no Node.js)
console.log('Downloader.js (ESM) telah dimuat');
const API_BASE = 'https://api.ferdev.my.id/downloader';

class Downloader {
  constructor() {}

  // --- UTILITY ---
  sanitizeFileName(filename) {
    return filename
      .replace(/[\\\/:*?"<>|]/g, '')
      .replace(/[^\w\s\-\.\(\)\&@]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatNumber(num) {
    num = Number(num) || 0;
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  }

  formatSizeUnits(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
    return bytes + ' B';
  }

  // --- DETECT PLATFORM ---
  detectPlatform(videoUrl) {
    const url = videoUrl.toLowerCase();
    const platforms = [
      { check: ['instagram.com'], name: 'Instagram', endpoint: 'instagram' },
      { check: ['tiktok.com', 'vm.tiktok.com'], name: 'TikTok', endpoint: 'tiktok' },
      { check: ['twitter.com', 'x.com'], name: 'Twitter', endpoint: 'twitter' },
      { check: ['douyin.com', 'v.douyin.com'], name: 'Douyin', endpoint: 'dou_douyin' },
      { check: ['snackvideo.com', 's.snackvideo.com'], name: 'SnackVideo', endpoint: 'snackvideo' },
      { check: ['mediafire.com'], name: 'MediaFire', endpoint: 'mediafire' },
      { check: ['soundcloud.com'], name: 'SoundCloud', endpoint: 'soundcloud' },
      { check: ['threads.net', 'threads.com'], name: 'Threads', endpoint: 'threads' },
      { check: ['xvideos.com'], name: 'Xvideos', endpoint: 'xvideos' },
      { check: ['spotify.com'], name: 'Spotify', endpoint: 'spotify' },
      { check: ['youtube.com', 'youtu.be'], name: 'YouTube', endpoint: 'youtube' },
      { check: ['facebook.com', 'fb.watch', 'm.facebook.com'], name: 'Facebook', endpoint: 'facebook' }
    ];

    for (const p of platforms) {
      if (p.check.some(domain => url.includes(domain))) {
        return {
          platform: p.name,
          apiUrl: `${API_BASE}/${p.endpoint}?link=${encodeURIComponent(videoUrl)}&apikey=${API_KEY}`
        };
      }
    }
    return null;
  }

  // --- MAIN DOWNLOAD FUNCTION ---
  async download(videoUrl) {
    const platformInfo = this.detectPlatform(videoUrl);
    if (!platformInfo) {
      return { success: false, error: 'Platform tidak dikenali.' };
    }

    try {
      console.log(`[DOWNLOADER] Mengambil data dari: ${platformInfo.platform}`);
      
      // SATU KALI FETCH → SATU KALI const response
      const response = await fetch(platformInfo.apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      let jsonData;
      try {
        jsonData = JSON.parse(text);
      } catch (e) {
        console.error('[DOWNLOADER] Respon bukan JSON:', text.slice(0, 200));
        throw new Error('Respon API tidak valid (bukan JSON).');
      }

      const handler = this.getHandler(platformInfo.platform);
      if (!handler) {
        return { success: false, error: 'Handler tidak ditemukan untuk platform ini.' };
      }

      const handlerResult = await handler(jsonData);
      if (!handlerResult.success) return handlerResult;

      // Normalisasi media
      let media = [];
      if (Array.isArray(handlerResult.media)) {
        media = handlerResult.media.map(item => {
          if (typeof item === 'string') {
            return { url: item, type: item.includes('.mp4') ? 'video' : 'image' };
          }
          return {
            url: item.url || item,
            type: item.type || (item.url?.includes('.mp4') ? 'video' : 'image')
          };
        }).filter(m => m.url);
      } else if (handlerResult.url) {
        media = [{
          url: handlerResult.url,
          type: handlerResult.type || (handlerResult.url.includes('.mp4') ? 'video' : 'image')
        }];
      }

      if (media.length === 0) {
        return { success: false, error: 'Tidak ada media yang ditemukan.' };
      }

      const thumbnail = handlerResult.thumbnail || media[0].url;

      return {
        success: true,
        media,
        thumbnail,
        caption: handlerResult.caption || handlerResult.title || 'Media',
        type: handlerResult.type || media[0].type
      };

    } catch (err) {
      console.error('[DOWNLOADER] ERROR:', err.message);
      return { success: false, error: 'Gagal menghubungi API: ' + err.message };
    }
  }

  // --- GET HANDLER ---
  getHandler(platform) {
    const handlers = {
      'Instagram': this.handleInstagram.bind(this),
      'TikTok': this.handleTikTok.bind(this),
      'Twitter': this.handleTwitter.bind(this),
      'Douyin': this.handleDouyin.bind(this),
      'SnackVideo': this.handleSnackVideo.bind(this),
      'MediaFire': this.handleMediaFire.bind(this),
      'SoundCloud': this.handleSoundCloud.bind(this),
      'Threads': this.handleThreads.bind(this),
      'Xvideos': this.handleXvideos.bind(this),
      'Spotify': this.handleSpotify.bind(this),
      'YouTube': this.handleYoutube.bind(this),
      'Facebook': this.handleFacebook.bind(this)
    };
    return handlers[platform] || null;
  }

  // --- HANDLERS ---
  async handleFacebook(data) {
    if (!data || !data.success) return { success: false, error: 'Gagal mendapatkan data.' };
    const d = data.data || data;
    const videoUrl = d.hd || d.sd || d.url || d.video_url;
    if (!videoUrl) return { success: false, error: 'URL video tidak ditemukan.' };
    return {
      success: true,
      type: 'video',
      media: [{ url: videoUrl, type: 'video' }],
      caption: `Facebook Video\n${d.title || d.caption || 'Video'}`,
      thumbnail: d.thumbnail
    };
  }

  async handleInstagram(data) {
    if (!data.data) return { success: false, error: 'Data Instagram tidak ditemukan.' };
    const d = data.data;
    const username = d.username || d.metadata?.username || '-';
    const likes = this.formatNumber(d.likeCount || d.metadata?.likeCount || 0);
    const title = d.metadata?.title || '(Tanpa Judul)';
    const caption = `${title}\nBy @${username}\n${likes} Likes`;

    let videoUrl = '';
    const photoUrls = [];

    if (d.videoUrls?.[0]?.url) {
      videoUrl = d.videoUrls[0].url;
    } else if (d.slides) {
      for (const slide of d.slides) {
        for (const media of (slide.mediaUrls || [])) {
          const ext = (media.ext || '').toLowerCase();
          if (ext === 'mp4' && !videoUrl) videoUrl = media.url;
          else if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) photoUrls.push(media.url);
        }
        if (videoUrl) break;
      }
    }

    if (videoUrl) {
      return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption, thumbnail: d.thumbnail || videoUrl };
    } else if (photoUrls.length > 0) {
      return { success: true, type: 'photo', media: photoUrls.map(url => ({ url, type: 'image' })), caption, thumbnail: photoUrls[0] };
    } else {
      return { success: false, error: 'Tidak ditemukan media.' };
    }
  }

  async handleTikTok(data) {
    if (!data.data) return { success: false, error: 'Data TikTok tidak ditemukan.' };
    const d = data.data;
    const videoUrl = d.play || '';
    if (!videoUrl) return { success: false, error: 'URL video tidak ditemukan.' };
    const username = d.author?.unique_id || '-';
    const views = this.formatNumber(d.play_count || 0);
    const title = d.title || '(Tanpa Judul)';
    const caption = `<b>${this.escapeHtml(title)}</b>\nBy <a href="https://www.tiktok.com/@${username}">@${username}</a>\n${views} Views`;
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption };
  }

  async handleTwitter(data) {
    if (!data.result) return { success: false, error: 'Data Twitter tidak ditemukan.' };
    const videoUrl = data.result.HD?.url || data.result.SEMI_HD?.url || data.result.SD?.url;
    if (!videoUrl) return { success: false, error: 'URL video tidak ditemukan.' };
    const title = data.title || '(Tanpa Judul)';
    const quality = data.result.HD ? 'HD' : data.result.SEMI_HD ? 'SEMI HD' : 'SD';
    const caption = `Downloader Twitter\n\n<b>Judul:</b> ${this.escapeHtml(title)}\n<b>Kualitas:</b> ${quality}`;
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption };
  }

  async handleDouyin(data) {
    if (!data.result?.result?.download?.no_watermark) return { success: false, error: 'URL video tidak ditemukan.' };
    const videoUrl = data.result.result.download.no_watermark;
    const title = data.result.result.title || '(Tanpa Judul)';
    const caption = `Downloader Douyin\n\n<b>Judul:</b> ${this.escapeHtml(title)}`;
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption };
  }

  async handleSnackVideo(data) {
    const videoUrl = data.result?.video?.downloadUrl;
    if (!videoUrl) return { success: false, error: 'URL video tidak ditemukan.' };
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption: '*Downloader SnackVideo*' };
  }

  async handleMediaFire(data) {
    if (!data.data?.download) return { success: false, error: 'File tidak ditemukan.' };
    const download = data.data.download;
    const filename = this.sanitizeFileName(data.data.filename || 'File');
    const filesize = data.data.size || '';
    const caption = `*MediaFire File:*\n*${filename}*${filesize ? ` (${filesize})` : ''}\n\n[Klik untuk mengunduh](${download})`;
    return { success: true, type: 'document', media: [{ url: download, type: 'document' }], caption, filename };
  }

  async handleSoundCloud(data) {
    if (!data.result?.downloadUrl) return { success: false, error: 'Data tidak valid.' };
    const download = data.result.downloadUrl;
    const title = data.result.title || 'Audio SoundCloud';
    const artist = data.result.author || 'Unknown Artist';
    const genre = data.result.genre || '';
    const caption = `SoundCloud Audio:\n${artist} - ${title}.mp3\nOleh: <b>${this.escapeHtml(artist)}</b>\nJudul: <i>${this.escapeHtml(title)}</i>${genre ? `\nGenre: <i>${this.escapeHtml(genre)}</i>` : ''}`;
    return { success: true, type: 'audio', media: [{ url: download, type: 'audio' }], caption };
  }

  async handleThreads(data) {
    if (!data.success || !data.result) return { success: false, error: 'Media tidak ditemukan.' };
    if (typeof data.result === 'string' && data.result) {
      return { success: true, type: 'video', media: [{ url: data.result, type: 'video' }], caption: 'Threads Media' };
    } else if (Array.isArray(data.result) && data.result.length > 0) {
      return { success: true, type: 'photo', media: data.result.map(url => ({ url, type: 'image' })), caption: 'Threads Media' };
    } else {
      return { success: false, error: 'Tidak ada media.' };
    }
  }

  async handleXvideos(data) {
    const videoUrl = data.result?.videos?.high || data.result?.videos?.low;
    if (!videoUrl) return { success: false, error: 'URL video tidak ditemukan.' };
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption: 'Xvideos Media' };
  }

  async handleSpotify(data) {
    if (!data.data) return { success: false, error: 'Data Spotify tidak ditemukan.' };
    const d = data.data;
    const title = d.title || '(Tanpa Judul)';
    const artist = d.artist || '(Tidak diketahui)';
    const thumbnail = d.thumbnail || null;
    let caption = `Spotify Downloader\n\n<b>Judul:</b> ${this.escapeHtml(title)}\n<b>Artist:</b> ${this.escapeHtml(artist)}\n`;

    if (data.download && typeof data.download === 'string') {
      caption += `<b>Download:</b> ${this.escapeHtml(title)}`;
      return { success: true, type: 'audio', media: [{ url: data.download, type: 'audio' }], caption, thumbnail };
    } else if (data.download && Array.isArray(data.download) && data.download[0]?.mediaUrl) {
      const track = data.download[0];
      const trackTitle = track.title || '(Tidak ada judul)';
      const trackNum = track.number || '';
      caption += `<b>Track:</b> #${trackNum} ${this.escapeHtml(trackTitle)}`;
      return { success: true, type: 'audio', media: [{ url: track.mediaUrl, type: 'audio' }], caption, thumbnail };
    } else {
      return { success: false, error: 'Format tidak valid.' };
    }
  }

  async handleYoutube(data) {
    const d = data.data || {};
    const title = d.title || '(Tanpa Judul)';
    const duration = d.duration || '-';
    const thumbnail = d.thumbnail || '';
    const dlinks = Array.isArray(d.dlink) ? [...new Set(d.dlink)] : [];
    if (dlinks.length === 0) return { success: false, error: 'Link video tidak ditemukan.' };
    const videoUrl = dlinks[0];
    const caption = `*Downloader MP4*\n\n*Judul:* ${this.escapeMarkdown(title)}\n*Durasi:* \`${this.escapeMarkdown(duration)}\``;
    return { success: true, type: 'video', media: [{ url: videoUrl, type: 'video' }], caption, thumbnail };
  }

  // --- UTILS ---
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  escapeMarkdown(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}

// EKSPOR KE BROWSER
window.Downloader = Downloader;
export default Downloader;