require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_TOKEN;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// ✅ Configuration CORS
app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// ✅ Vérification des variables d'environnement
console.log("📌 Vérification des variables d'environnement...");
console.log("🔑 GOOGLE_SEARCH_TOKEN:", GOOGLE_SEARCH_API_KEY ? "OK" : "NON DÉFINI");
console.log("🔍 GOOGLE_SEARCH_CX:", GOOGLE_SEARCH_CX ? "OK" : "NON DÉFINI");
console.log("🐦 BEARER_TOKEN Twitter:", BEARER_TOKEN ? "OK" : "NON DÉFINI");
console.log("🌍 GOOGLE_API_KEY:", GOOGLE_API_KEY ? "OK" : "NON DÉFINI");

// ✅ Route principale Twitter
app.get("/twitter-from-website", async (req, res) => {
  const siteInternet = req.query.siteInternet;
  if (!siteInternet) return res.status(400).json({ error: "URL du site requise" });

  try {
    console.log(`🔎 Recherche d'un compte Twitter lié au site : ${siteInternet}`);

    const url = `https://api.twitter.com/2/users/by?user.fields=public_metrics,entities`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (!data || !data.data) return res.status(404).json({ error: "Aucun compte Twitter trouvé." });

    const matchingAccount = data.data.find(user =>
      user.entities?.url?.urls?.some(u => u.expanded_url.includes(siteInternet))
    );

    if (!matchingAccount) return res.status(404).json({ error: "Aucun compte Twitter trouvé." });

    console.log(`✅ Compte Twitter trouvé : @${matchingAccount.username}`);

    res.json({
      username: matchingAccount.username,
      abonnés: matchingAccount.public_metrics.followers_count,
      nom: matchingAccount.name
    });

  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    res.status(500).json({ error: "Erreur serveur Twitter." });
  }
});

// ✅ Route pour récupérer le Place ID Google
app.get("/api/get-place-id", async (req, res) => {
  const siteInternet = req.query.siteInternet;
  if (!siteInternet) return res.status(400).json({ error: "URL requise" });

  try {
    const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(siteInternet)}&inputtype=textquery&fields=name,place_id,formatted_address&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeSearchUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Erreur API Google :", error);
    res.status(500).json({ error: "Erreur serveur Google." });
  }
});

// ✅ Route pour récupérer les avis Google
app.get("/api/get-reviews", async (req, res) => {
  const placeId = req.query.placeId;
  if (!placeId) return res.status(400).json({ error: "Place ID requis" });

  try {
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&fields=name,reviews&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeDetailsUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Erreur API Google :", error);
    res.status(500).json({ error: "Erreur serveur Google." });
  }
});

// ✅ Route de recherche YouTube via Google Search API
// ✅ Route pour **chercher une chaîne YouTube** associée à un site web
app.get("/find-youtube-channel", async (req, res) => {
    const siteInternet = req.query.siteInternet;
    if (!siteInternet) {
        return res.status(400).json({ error: "URL du site requise" });
    }

    try {
        console.log(`🔎 Recherche d'une chaîne YouTube pour : ${siteInternet}`);

        // 🔍 Recherche Google ciblée sur YouTube
        const searchQuery = `site:youtube.com ${siteInternet}`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&cx=${GOOGLE_SEARCH_CX}&key=${GOOGLE_SEARCH_API_KEY}`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: "Aucune chaîne YouTube trouvée pour ce site." });
        }

        // 📌 Extraire l'URL de la chaîne YouTube
        const firstResult = data.items[0];

        let channelId = null;
        if (firstResult.link.includes("youtube.com/channel/")) {
            channelId = firstResult.link.split("/channel/")[1];
        } else if (firstResult.link.includes("youtube.com/c/")) {
            channelId = firstResult.link.split("/c/")[1];
        } else if (firstResult.link.includes("youtube.com/user/")) {
            channelId = firstResult.link.split("/user/")[1];
        }

        if (!channelId) {
            return res.status(404).json({ error: "Impossible d'extraire l'ID de la chaîne." });
        }

        console.log(`✅ Chaîne YouTube trouvée : ${firstResult.title} (ID: ${channelId})`);

        res.json({
            channelTitle: firstResult.title,
            channelId: channelId,
            channelUrl: firstResult.link
        });

    } catch (error) {
        console.error("❌ Erreur API Google Search :", error);
        res.status(500).json({ error: "Erreur serveur lors de la recherche YouTube." });
    }
});

// ✅ Route pour récupérer **le nombre d'abonnés YouTube**
app.get("/youtube-subscribers", async (req, res) => {
    const channelId = req.query.channelId;
    if (!channelId) {
        return res.status(400).json({ error: "ID de chaîne requis" });
    }

    try {
        console.log(`🔍 Recherche des abonnés pour la chaîne ID: ${channelId}`);

        const youtubeUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${GOOGLE_API_KEY}`;
        console.log(`📡 URL API YouTube: ${youtubeUrl}`);

        const response = await fetch(youtubeUrl);
        const data = await response.json();

        console.log("📡 Réponse brute API YouTube:", JSON.stringify(data, null, 2));

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: "Chaîne YouTube introuvable." });
        }

        const subscribers = data.items[0].statistics.subscriberCount;
        res.json({ channelId, subscribers });

    } catch (error) {
        console.error("❌ Erreur API YouTube :", error);
        res.status(500).json({ error: "Erreur serveur YouTube." });
    }
});

// ✅ Lancer le serveur
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur en écoute sur http://localhost:${PORT}`);
});