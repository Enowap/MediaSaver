// apikey.js
export const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("⚠️ [WARNING] API_KEY belum diset di Environment Vercel!");
}