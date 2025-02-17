const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express(); // 📌 C'est ici que l'application Express est initialisée
const PORT = process.env.PORT || 5000;
const bearerToken = process.env.BEARER_TOKEN; // Assurez-vous que ce token est bien défini

app.use(cors());

app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
  const url = `https://api.twitter.com/2/users/by/username/${username}`;

  try {
    console.log(`🔄 Requête API Twitter pour : ${username}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    console.log("📢 Réponse API Twitter :", JSON.stringify(data, null, 2));

    if (data.errors) {
      res.status(404).json({ error: "Utilisateur non trouvé", details: data.errors });
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
});

// 📌 Ajoute ceci pour lancer ton serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur proxy en écoute sur http://localhost:${PORT}`);
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

