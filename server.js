require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT; // Render gère le port automatiquement
const BEARER_TOKEN = process.env.BEARER_TOKEN;

// ✅ Activer CORS pour toutes les requêtes
app.use(cors({ origin: "*" }));
console.log("✅ CORS activé pour toutes les origines");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://digitalfactory.store");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// ✅ Vérifier si le BEARER_TOKEN est chargé correctement
app.get("/test-env", (req, res) => {
  res.json({ 
    bearerToken: BEARER_TOKEN ? "OK" : "NON DEFINI"
  });
});

// ✅ Vérifier si Render peut contacter Twitter
app.get("/test-twitter", async (req, res) => {
  try {
    const response = await fetch("https://api.twitter.com/2/tweets?ids=123", {
      method: "GET",
      headers: { "Authorization": `Bearer ${BEARER_TOKEN}` }
    });
    const data = await response.json();
    console.log("📢 Réponse de Twitter:", JSON.stringify(data, null, 2));
    res.status(response.status).json(data);
  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    res.status(500).json({ error: "Échec de connexion", details: error.message });
  }
});

// ✅ Récupérer les infos d’un utilisateur Twitter
app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
  const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`;

  try {
    console.log(`🔍 Recherche de l'utilisateur : ${username}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    console.log("📢 Réponse complète de Twitter :", JSON.stringify(data, null, 2));

    if (data.data) {
      res.json({
        id: data.data.id,
        name: data.data.name,
        username: data.data.username,
        abonnés: data.data.public_metrics.followers_count,
      });
    } else {
      console.log("⚠️ Aucun utilisateur trouvé. Réponse de Twitter :", data);
      res.status(404).json({ error: "Utilisateur non trouvé", details: data });
    }
  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
});

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

