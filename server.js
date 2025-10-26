// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');           // TAMBAHKAN INI
const Downloader = require('./downloader');
const { API_KEY } = require('./apikey');

const app = express();
const PORT = process.env.PORT || 3000;
const downloader = new Downloader();

// Middleware
app.use(cors());                        // INI YANG WAJIB! BUKA CORS
app.use(express.json());
app.use(express.static('public'));

// === API ENDPOINT: /api/download ===
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL diperlukan.' });
  }

  try {
    console.log('[SERVER] Mengunduh:', url);
    const result = await downloader.download(url.trim());

    // === VALIDASI HASIL ===
    if (!result || !result.success) {
      const errorMsg = result?.error || 'Gagal mengambil data dari scraper';
      console.warn('[SERVER] Gagal:', errorMsg);
      return res.status(400).json({ success: false, error: errorMsg });
    }

    if (!Array.isArray(result.media) || result.media.length === 0 || !result.media[0]?.url) {
      console.warn('[SERVER] Media kosong atau URL tidak valid:', result.media);
      return res.status(400).json({ success: false, error: 'Tidak ada media ditemukan.' });
    }

    const mediaObj = result.media[0];
    const mediaUrl = mediaObj.url;

    console.log('[SERVER] Sukses → URL:', mediaUrl);

    const mediaItem = {
      url: mediaUrl,
      type: mediaObj.type || (mediaUrl.includes('.mp4') ? 'video' : 'image'),
      resolution: 'HD'
    };

    res.json({
      success: true,
      data: {
        media: [mediaItem],
        preview: result.thumbnail || mediaUrl,
        caption: result.caption || ''
      }
    });

  } catch (err) {
    console.error('[SERVER] ERROR:', err.message);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

// === PROXY UNTUK SHORTLINK (get.php) ===
app.get("/proxy/get.php", async (req, res) => {
  const { send, source } = req.query;

  if (!send) {
    return res.status(400).json({ status: "error", message: "Missing 'send' parameter." });
  }

  const targetUrl = `https://shtl.pw/getmylink/get.php?send=${send}&source=${source || ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await response.json();

    if (data.status === "error" && /wrong type of the web page content/i.test(data.message || "")) {
      console.warn("Detected non-direct video content, attempting fallback relay...");

      try {
        const relayResponse = await fetch(send);
        const contentType = relayResponse.headers.get("content-type") || "video/mp4";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", 'inline; filename="video.mp4"');
        relayResponse.body.pipe(res);
        return;
      } catch (relayErr) {
        console.error("Fallback relay failed:", relayErr.message);
        return res.status(500).json({
          status: "error",
          message: `Relay fallback failed: ${relayErr.message}`,
        });
      }
    }

    res.json(data);
  } catch (error) {
    console.error("Error in /proxy/get.php:", error.message);
    res.status(500).json({
      status: "error",
      message: `Failed to connect to get.php: ${error.message}`,
    });
  }
});

// === Serve halaman utama ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});