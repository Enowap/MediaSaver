// downloader.js
// public/downloader.js
// ESM Version – Tidak butuh Node.js (fs, path, dll)
// Hanya pakai API browser: fetch, URL, console

console.log('Downloader.js (ESM) telah dimuat');

const API_KEY = import.meta.env?.VITE_API_KEY || 'YOUR_API_KEY_HERE'; // Ganti di .env atau Vercel
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
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    }

    formatSizeUnits(bytes) {
        if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
        if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
        if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
        return bytes + ' B';
    }

    // --- DETECT PLATFORM & BUILD URL ---
    detectPlatform(videoUrl) {
        const url = videoUrl.toLowerCase();
        const platforms = [
            { check: ['instagram.com'], name: 'Instagram', endpoint: 'instagram' },
            { check: ['tiktok.com', 'vm.tiktok.com'], name: 'TikTok', endpoint: 'tiktok' },
            { check: ['twitter.com', 'x.com'], name: 'Twitter', endpoint: 'twitter' },
            { check: ['douyin.com', 'v.douyin.com'], name: 'Douyin', endpoint: 'douyin' },
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
const response = await fetch(platformInfo.apiUrl);
if (!response.ok) throw new Error(`HTTP ${response.status}`);

            

// 🔹 Tambahkan validasi JSON aman
const text = await response.text();
let data;
try {
    data = JSON.parse(text);
} catch (e) {
    console.error('[DOWNLOADER] Respon bukan JSON:', text.slice(0, 200));
    throw new Error('Respon API tidak valid (bukan JSON).');
}
            

            const data = await response.json();

            const handler = this.getHandler(platformInfo.platform);
            if (!handler) {
                return { success: false, error: 'Handler tidak ditemukan untuk platform ini.' };
            }

            const handlerResult = await handler(data);

            if (!handlerResult.success) {
                return handlerResult;
            }

            // Normalisasi media: pastikan array objek { url, type }
            let media = [];
            if (Array.isArray(handlerResult.media)) {
                media = handlerResult.media.map(item => {
                    if (typeof item === 'string') {
                        return {
                            url: item,
                            type: item.includes('.mp4') ? 'video' : 'image'
                        };
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

            // Pastikan thumbnail valid
            const firstMediaUrl = media[0].url;
            const thumbnail = handlerResult.thumbnail || firstMediaUrl;

            // Return format konsisten
            return {
                success: true,
                media: media,
                thumbnail: thumbnail,
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
            'MediaFire': this.handleMediaFire.bind(this),     // FIXED: Case
            'SoundCloud': this.handleSoundCloud.bind(this),   // FIXED: Case
            'Threads': this.handleThreads.bind(this),
            'Xvideos': this.handleXvideos.bind(this),
            'Spotify': this.handleSpotify.bind(this),
            'YouTube': this.handleYoutube.bind(this),
            'Facebook': this.handleFacebook.bind(this)
        };
        return handlers[platform] || null;
    }

    // --- HANDLER: FACEBOOK ---
    async handleFacebook(data) {
        try {
            console.log('Memproses data Facebook...');
            if (!data || !data.success) {
                throw new Error(data?.message || 'Gagal mendapatkan data dari API Facebook.');
            }

            const d = data.data || data;
            const videoUrl = d.hd || d.sd || d.url || d.video_url;
            if (!videoUrl) throw new Error('URL video Facebook tidak ditemukan.');

            const title = d.title || d.caption || 'Facebook Video';
            const thumbnail = d.thumbnail || null;

            return {
                success: true,
                type: 'video',
                media: [{ url: videoUrl, type: 'video' }],
                caption: `Facebook Video\n${title}`,
                thumbnail
            };
        } catch (err) {
            console.error('handleFacebook error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // --- HANDLER: INSTAGRAM (FIXED!) ---
    async handleInstagram(data) {
        if (!data.data) return { success: false, error: 'Data Instagram tidak ditemukan.' };

        const d = data.data;
        const username = d.username || (d.metadata?.username) || '-';
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
            return {
                success: true,
                type: 'video',
                media: [{ url: videoUrl, type: 'video' }],
                caption,
                thumbnail: d.thumbnail || videoUrl
            };
        } else if (photoUrls.length > 0) {
            return {
                success: true,
                type: 'photo',
                media: photoUrls.map(url => ({ url, type: 'image' })),
                caption,
                thumbnail: photoUrls[0]
            };
        } else {
            return { success: false, error: 'Tidak ditemukan media dari postingan ini.' };
        }
    }

    // --- HANDLER LAIN (SUDAH DIPERBAIKI FORMAT) ---
    async handleTikTok(data) {
        if (!data.data) return { success: false, error: 'Data TikTok tidak ditemukan.' };
        const d = data.data;
        const videoUrl = d.play || '';
        if (!videoUrl) return { success: false, error: 'Gagal mendapatkan URL video dari TikTok.' };

        const username = d.author?.unique_id || '-';
        const views = this.formatNumber(d.play_count || 0);
        const title = d.title || '(Tanpa Judul)';
        const caption = `<b>${this.escapeHtml(title)}</b>\nBy <a href="https://www.tiktok.com/@${username}">@${username}</a>\n${views} Views`;

        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption
        };
    }

    async handleTwitter(data) {
        if (!data.result) return { success: false, error: 'Data Twitter tidak ditemukan.' };
        const hd = data.result.HD?.url;
        const semi = data.result.SEMI_HD?.url;
        const sd = data.result.SD?.url;
        const videoUrl = hd || semi || sd;
        if (!videoUrl) return { success: false, error: 'Gagal mendapatkan URL video dari Twitter.' };

        const title = data.title || '(Tanpa Judul)';
        const quality = hd ? 'HD' : semi ? 'SEMI HD' : 'SD';
        const caption = `Downloader Twitter\n\n<b>Judul:</b> ${this.escapeHtml(title)}\n<b>Kualitas:</b> ${quality}`;

        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption
        };
    }

    async handleDouyin(data) {
        if (!data.result?.result?.download?.no_watermark) {
            return { success: false, error: 'Gagal mendapatkan URL video dari Douyin.' };
        }
        const videoUrl = data.result.result.download.no_watermark;
        const title = data.result.result.title || '(Tanpa Judul)';
        const caption = `Downloader Douyin\n\n<b>Judul:</b> ${this.escapeHtml(title)}`;

        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption
        };
    }

    async handleSnackVideo(data) {
        const videoUrl = data.result?.video?.downloadUrl;
        if (!videoUrl) return { success: false, error: 'Gagal mendapatkan URL video dari SnackVideo.' };
        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption: '*Downloader SnackVideo*'
        };
    }

    async handleMediaFire(data) {
        if (!data.data?.download) return { success: false, error: 'File MediaFire tidak ditemukan.' };
        const download = data.data.download;
        const filename = this.sanitizeFileName(data.data.filename || 'File');
        const filesize = data.data.size || '';
        const caption = `*MediaFire File:*\n*${filename}*${filesize ? ` (${filesize})` : ''}\n\n[Klik untuk mengunduh](${download})`;

        return {
            success: true,
            type: 'document',
            media: [{ url: download, type: 'document' }],
            caption,
            filename
        };
    }

    async handleSoundCloud(data) {
        if (!data.result?.downloadUrl) return { success: false, error: 'Data SoundCloud tidak valid.' };
        const download = data.result.downloadUrl;
        const title = data.result.title || 'Audio SoundCloud';
        const artist = data.result.author || 'Unknown Artist';
        const genre = data.result.genre || '';
        const caption = `SoundCloud Audio:\n${artist} - ${title}.mp3\nOleh: <b>${this.escapeHtml(artist)}</b>\nJudul: <i>${this.escapeHtml(title)}</i>${genre ? `\nGenre: <i>${this.escapeHtml(genre)}</i>` : ''}`;

        return {
            success: true,
            type: 'audio',
            media: [{ url: download, type: 'audio' }],
            caption
        };
    }

    async handleThreads(data) {
        if (!data.success || !data.result) {
            return { success: false, error: `Threads gagal: ${data.message || 'Media tidak ditemukan'}` };
        }

        if (typeof data.result === 'string' && data.result) {
            return {
                success: true,
                type: 'video',
                media: [{ url: data.result, type: 'video' }],
                caption: 'Threads Media by <i>NitroDl</i>'
            };
        } else if (Array.isArray(data.result) && data.result.length > 0) {
            return {
                success: true,
                type: 'photo',
                media: data.result.map(url => ({ url, type: 'image' })),
                caption: 'Threads Media by <i>NitroDl</i>'
            };
        } else {
            return { success: false, error: 'Tidak ditemukan media dari Threads.' };
        }
    }

    async handleXvideos(data) {
        const videoUrl = data.result?.videos?.high || data.result?.videos?.low;
        if (!videoUrl) return { success: false, error: 'Gagal mendapatkan URL video dari Xvideos.' };
        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption: 'Xvideos Media by <i>NitroDl</i>'
        };
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
            return {
                success: true,
                type: 'audio',
                media: [{ url: data.download, type: 'audio' }],
                caption,
                thumbnail
            };
        } else if (data.download && Array.isArray(data.download) && data.download[0]?.mediaUrl) {
            const track = data.download[0];
            const trackTitle = track.title || '(Tidak ada judul)';
            const trackNum = track.number || '';
            caption += `<b>Track:</b> #${trackNum} ${this.escapeHtml(trackTitle)}`;
            return {
                success: true,
                type: 'audio',
                media: [{ url: track.mediaUrl, type: 'audio' }],
                caption,
                thumbnail
            };
        } else {
            return { success: false, error: 'Format data Spotify tidak valid.' };
        }
    }

    async handleYoutube(data) {
        const d = data.data || {};
        const title = d.title || '(Tanpa Judul)';
        const duration = d.duration || '-';
        const thumbnail = d.thumbnail || '';
        const dlinks = Array.isArray(d.dlink) ? [...new Set(d.dlink)] : [];

        if (dlinks.length === 0) return { success: false, error: 'Gagal mendapatkan link video.' };

        const videoUrl = dlinks[0];
        const caption = `*Downloader MP4*\n\n*Judul:* ${this.escapeMarkdown(title)}\n*Durasi:* \`${this.escapeMarkdown(duration)}\``;

        return {
            success: true,
            type: 'video',
            media: [{ url: videoUrl, type: 'video' }],
            caption,
            thumbnail
        };
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


// EKSPOR UNTUK BROWSER (ESM)
window.Downloader = Downloader;