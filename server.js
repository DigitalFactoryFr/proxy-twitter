
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const BEARER_TOKEN = process.env.BEARER_TOKEN; // Remplace avec ton vrai token

// ✅ Activer CORS pour toutes les requêtes
app.use(cors({ origin: "*" }));
console.log("✅ CORS activé pour toutes les origines");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://digitalfactory.store");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});


app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
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
      res.json({
        id: data.data.id,
        name: data.data.name,
        username: data.data.username,
        abonnés: data.data.public_metrics.followers_count,
      });
    } else {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  } catch (error) {
    console.error("❌ Erreur API Twitter :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Lancer le serveur après avoir bien défini toutes les routes et middleware
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur proxy en écoute sur PORT: ${PORT}`);
});

