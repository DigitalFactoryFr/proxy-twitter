const cache = require("memory-cache"); // Cache pour éviter trop de requêtes
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

app.use(cors({ origin: "*" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://digitalfactory.store");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

/**
 * 🔹 1) Récupérer le compte Twitter depuis un site web
 */
app.get("/twitter-from-website", async (req, res) => {
  const siteInternet = req.query.siteInternet;
  if (!siteInternet) {
    return res.status(400).json({ error: "URL du site requise" });
  }

  // Vérifier si l'info est en cache
  let cachedData = cache.get(siteInternet);
  if (cachedData) {
    console.log("⚡ Récupération du cache pour Twitter");
    return res.json(cachedData);
  }

  try {
    // Scraper la page web pour trouver un lien Twitter
    const response = await fetch("https://corsproxy.io/?" + encodeURIComponent(siteInternet));
    const html = await response.text();
    
    const twitterMatch = html.match(/https:\/\/twitter\.com\/([a-zA-Z0-9_]+)/);
    
    if (!twitterMatch || !twitterMatch[1]) {
      return res.status(404).json({ error: "Aucun compte Twitter trouvé sur ce site." });
    }

    const twitterUsername = twitterMatch[1];
    console.log(`🔍 Compte Twitter détecté : ${twitterUsername}`);

    // Récupérer les abonnés Twitter
    const twitterData = await fetchTwitterFollowers(twitterUsername);
    if (!twitterData) {
      return res.status(500).json({ error: "Impossible de récupérer les abonnés Twitter." });
    }

    // Sauvegarde dans le cache (1 heure)
    const result = { username: twitterUsername, abonnés: twitterData };
    cache.put(siteInternet, result, 3600000);
    res.json(result);
  } catch (error) {
    console.error("❌ Erreur de scraping :", error);
    res.status(500).json({ error: "Erreur serveur lors du scraping." });
  }
});

/**
 * 🔹 2) Récupérer les abonnés d’un compte Twitter
 */
async function fetchTwitterFollowers(username) {
  const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (data.data) {
      return data.data.public_metrics.followers_count;
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    return null;
  }
}

// ✅ Lancer le serveur
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur proxy en écoute sur PORT: ${PORT}`);
});




const GOOGLE_API_KEY = process.env.GOOGLE_TOKEN;;

app.use(cors());

// Route pour récupérer le Place ID à partir du site web
app.get("/api/get-place-id", async (req, res) => {
  const siteInternet = req.query.siteInternet;
  if (!siteInternet) {
    return res.status(400).json({ error: "URL requise" });
  }

  try {
    const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(siteInternet)}&inputtype=textquery&fields=name,place_id,formatted_address&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeSearchUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur API Google" });
  }
});

// Route pour récupérer les avis Google à partir du Place ID
app.get("/api/get-reviews", async (req, res) => {
  const placeId = req.query.placeId;
  if (!placeId) {
    return res.status(400).json({ error: "Place ID requis" });
  }

  try {
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&fields=name,reviews&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeDetailsUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur API Google" });
  }
});

