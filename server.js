import express from "express";
import path from "path";
import cors from "cors";
import Downloader from "./downloader.js"; 
// import fetch from "node-fetch"; // ❌ Dihapus jika sudah ada di downloader.js
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const downloader = new Downloader();

// === Middleware ===
app.use(cors());
app.use(express.json());

// ❌ DIHAPUS/DIKOMENTARI: Biarkan Vercel menangani file statis (public)
// app.use(express.static(path.join(__dirname, "public")));

// === Cek status API_KEY di log (Sangat Benar) ===
if (!process.env.API_KEY) {
  console.warn("❌ Environment variable API_KEY tidak ditemukan di Vercel!");
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
  const API_KEY = process.env.API_KEY; // ✅ API KEY diambil di sini

  if (!API_KEY) {
    return res.status(500).json({ success: false, error: "API Key tidak tersedia di server." });
  }

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "URL diperlukan." });
  }

  try {
    console.log("[SERVER] Mengunduh:", url);
    // ✅ API_KEY DITERUSKAN SEBAGAI ARGUMEN KEDUA
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







// === PROXY UNTUK SHORTLINK (Lanjutan) ===
app.get("/proxy/get.php", async (req, res) => {
  const { send, source } = req.query;
  const targetUrl = `https://shtl.pw/getmylink/get.php?send=${send}&source=${source || ""}`;

  if (!send) {
    return res.status(400).json({ status: "error", message: "Missing 'send' parameter." });
  }

  try {
    const fetch = (await import('node-fetch')).default; // Menggunakan dynamic import untuk fetch, jaga-jaga
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Respon bukan JSON:", text.slice(0, 100));
      return res.status(500).json({
        status: "error",
        message: "Respon dari server shortlink tidak valid JSON.",
      });
    }

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
// ❌ DIHAPUS/DIKOMENTARI: Vercel.json sudah menanganinya
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// ✅ Export Express app ke Vercel
export default app;