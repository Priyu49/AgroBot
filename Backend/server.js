import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express(); // ⚠ app must be defined BEFORE using it
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Helper function for retrying Gemini API calls
async function callGeminiWithRetry(url, body, config, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.post(url, body, config);
    } catch (err) {
      if (err.response?.status === 503 && i < retries - 1) {
        console.log(`503 received, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

// Your /api/chat route here
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ error: "Question cannot be empty." });
  }

  const body = {
    contents: [
      { parts: [{ text: `You are an expert agricultural assistant. Answer: ${question}` }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
  };

  const config = { headers: { "Content-Type": "application/json" } };

  const proUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const flashUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  let answer = "Sorry, I couldn’t find an answer.";

  try {
    let geminiResponse;
    try {
      geminiResponse = await callGeminiWithRetry(proUrl, body, config);
    } catch {
      geminiResponse = await callGeminiWithRetry(flashUrl, body, config);
    }

    if (
      geminiResponse?.data?.candidates?.[0]?.content?.parts?.length > 0
    ) {
      answer = geminiResponse.data.candidates[0].content.parts
        .map(p => p.text)
        .join("\n");
    }
  } catch (err) {
    console.error("Gemini API error:", err.message);
  }

  // Unsplash image
  let imageUrl = "https://via.placeholder.com/400x300?text=No+Image+Found";
  try {
    const unsplashResponse = await axios.get("https://api.unsplash.com/search/photos", {
      params: { query: question, client_id: UNSPLASH_ACCESS_KEY, per_page: 1 },
    });
    if (unsplashResponse.data.results?.[0]) {
      imageUrl = unsplashResponse.data.results[0].urls.regular;
    }
  } catch (err) {
    console.error("Unsplash error:", err.message);
  }

  res.json({ answer, imageUrl });
});

app.get("/", (req, res) => {
  res.send("🌾 Farmer Chatbot Server is running...");
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
