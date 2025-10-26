// server.js
import express from "express";
import path from "path";
import cors from "cors";
import Downloader from "./downloader.js"; // Ini adalah file sisi SERVER Anda
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const downloader = new Downloader();

// === Middleware ===
app.use(cors());
app.use(express.json());
// Pastikan ini mengarah ke folder yang benar tempat index.html Anda berada
app.use(express.static(path.join(__dirname, "public")));

// === Cek status API_KEY di log (tidak dikirim ke client) ===
if (!process.env.API_KEY) {
  console.warn("❌ Environment variable API_KEY tidak ditemukan di Vercel!");
} else {
  console.log("✅ API_KEY berhasil terdeteksi di environment.");
}

// === API CONFIG (GET) ===
// Endpoint ini HANYA untuk mengecek apakah server hidup.
// JANGAN PERNAH MENGIRIM API_KEY KE KLIEN.
app.get("/api/config", (req, res) => {
  res.json({
    status: "ok",
    message: "Server berjalan dengan aman 🔐",
    // apiKey: apiKey <--- DIHAPUS, INI SANGAT BERBAHAYA
  });
});

// === API ENDPOINT: /api/download ===
// Ini adalah endpoint yang akan dipanggil oleh klien
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
    // Memanggil file downloader.js sisi SERVER Anda
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







// === PROXY UNTUK SHORTLINK ===
app.get("/proxy/get.php", async (req, res) => {
  const { send, source } = req.query;

  if (!send) {
    return res.status(400).json({ status: "error", message: "Missing 'send' parameter." });
  }

  const targetUrl = `https://shtl.pw/getmylink/get.php?send=${send}&source=${source || ""}`;

  try {
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
// Pastikan ini mengarah ke file HTML utama Anda
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Export Express app ke Vercel
export default app;
