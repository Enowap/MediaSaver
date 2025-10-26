import express from "express";
import path from "path";
import cors from "cors";
import Downloader from "./downloader.js"; 
// import fetch from "node-fetch"; // ❌ Dihapus jika sudah ada di downloader.js
import { fileURLToPath } from "url";

// === Pengecekan Lingkungan dan Load .env ===
// Kita asumsikan Vercel (atau lingkungan produksi) mengatur NODE_ENV ke 'production'.
if (process.env.NODE_ENV !== 'production') {
  try {
    // Memuat dotenv secara dinamis
    const dotenv = (await import('dotenv')).default; 
    dotenv.config();
    console.log("✅ Menggunakan API_KEY dari file .env lokal.");
  } catch (e) {
    console.warn("⚠️ Pustaka 'dotenv' tidak ditemukan atau gagal dimuat.");
    console.warn("   Pastikan Anda telah menginstal 'dotenv' jika berjalan secara lokal.");
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const downloader = new Downloader();

// === Middleware ===
app.use(cors());
app.use(express.json());

// --- Logika Pelayanan File Statis Lokal (DIHAPUS di Vercel, Aktif di Lokal) ---
if (process.env.NODE_ENV !== 'production') {
    const publicPath = path.join(__dirname, "public");
    
    // 1. Mengaktifkan penyajian file statis dari folder 'public'
    app.use(express.static(publicPath));
    console.log(`💡 Mode lokal: Melayani file statis dari ${publicPath}`);
}
// --------------------------------------------------------------------------------

// === Cek status API_KEY di log ===
if (!process.env.API_KEY) {
  console.warn("❌ Environment variable API_KEY tidak ditemukan!");
} else {
  console.log("✅ API_KEY berhasil terdeteksi di environment.");
}

// === API CONFIG (GET) ===
app.get("/api/config", (req, res) => {
  res.json({
    status: "ok",
    message: "Server berjalan dengan aman 🔐",
  });
});

// === API ENDPOINT: /api/download (Sangat Benar) ===
app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  const API_KEY = process.env.API_KEY; 

  if (!API_KEY) {
    return res.status(500).json({ success: false, error: "API Key tidak tersedia di server." });
  }

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "URL diperlukan." });
  }

  try {
    console.log("[SERVER] Mengunduh:", url);
    const result = await downloader.download(url.trim(), API_KEY);

    if (!result || !result.success) {
      const errorMsg = result?.error || "Gagal mengambil data dari scraper";
      console.warn("[SERVER] Gagal:", errorMsg);
      return res.status(400).json({ success: false, error: errorMsg });
    }

    if (!Array.isArray(result.media) || result.media.length === 0 || !result.media[0]?.url) {
      console.warn("[SERVER] Media kosong atau URL tidak valid:", result.media);
      return res.status(400).json({ success: false, error: "Tidak ada media ditemukan." });
    }

    const mediaObj = result.media[0];
    const mediaUrl = mediaObj.url;

    console.log("[SERVER] Sukses → URL:", mediaUrl);

    const mediaItem = {
      url: mediaUrl,
      type: mediaObj.type || (mediaUrl.includes(".mp4") ? "video" : "image"),
      resolution: "HD",
    };

    res.json({
      success: true,
      data: {
        media: [mediaItem],
        preview: result.thumbnail || mediaUrl,
        caption: result.caption || "",
      },
    });
  } catch (err) {
    console.error("[SERVER] ERROR:", err.message);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
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
    const fetch = (await import('node-fetch')).default; // Pastikan fetch di-import atau tersedia
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    // Perbaikan: Ganti response.json() dengan response.text() diikuti try/catch untuk JSON.parse
    // Namun, jika Anda yakin layanan selalu mengembalikan JSON, kita pertahankan response.json()
    const data = await response.json(); 

    // 👇 LOGIKA FALLBACK BARU (MEMASUKKAN ERROR VIDEO FILE)
    const shortlinkErrorMessage = data.message || "";
    const shouldFallback = 
        /wrong type of the web page content/i.test(shortlinkErrorMessage) ||
        /URL does not point to a valid video file/i.test(shortlinkErrorMessage); 

    if (data.status === "error" && shouldFallback) {
        console.warn("Detected shortlink failure, attempting fallback relay...");

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
    // 👆 END LOGIKA FALLBACK

    res.json(data);
  } catch (error) {
    console.error("Error in /proxy/get.php:", error.message);
    res.status(500).json({
      status: "error",
      message: `Failed to connect to get.php: ${error.message}`,
    });
  }
});



// === PENGATURAN LINGKUNGAN (Lokal vs Vercel) ===
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  // Kondisi jika dijalankan secara lokal (development)

  // === Serve halaman utama (Hanya untuk lokal) ===
  // Menggunakan app.get di luar app.listen()
  app.get('/', (req, res) => {
    // Asumsi index.html ada di folder 'public'
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
  });
  
  // Perintah listen() menutup blok IF
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`   (Mode Lokal: ${process.env.NODE_ENV || 'development'})`);
  });

} else {
    // Kondisi else opsional, hanya untuk log jika diperlukan
    console.log(`🌍 Server berjalan dalam mode Produksi.`);
}


// ✅ Export Express app ke Vercel
// Baris ini HARUS ADA di bagian akhir agar Vercel dapat menjalankan aplikasi.
export default app;