require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_TOKEN;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
console.log("🤖 OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "NON DÉFINI");

// ✅ Route principale Twitter
app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
  const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`;

  try {

console.log("🔑 Bearer Token utilisé :", process.env.BEARER_TOKEN);

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

// ✅ Route pour récupérer les statistiques complètes de la chaîne YouTube
app.get("/youtube-channel-info", async (req, res) => {
    const channelHandle = req.query.channelHandle; // Ex: "@DigitalFactory"
    if (!channelHandle) {
        return res.status(400).json({ error: "Handle de chaîne requis (ex: @DigitalFactory)" });
    }

    try {
        console.log(`🔍 Recherche des infos pour la chaîne YouTube : ${channelHandle}`);

        // 1️⃣ Récupérer l'ID de la chaîne via le handle YouTube
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${channelHandle}&key=${GOOGLE_API_KEY}`;
        const handleResponse = await fetch(handleUrl);
        const handleData = await handleResponse.json();

        if (!handleData.items || handleData.items.length === 0) {
            return res.status(404).json({ error: "Aucune chaîne trouvée pour ce handle." });
        }

        const channelId = handleData.items[0].id;
        console.log(`✅ ID de la chaîne trouvé : ${channelId}`);

        // 2️⃣ Récupérer les statistiques de la chaîne (abonnés, vues, vidéos)
        const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${GOOGLE_API_KEY}`;
        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json();

        if (!statsData.items || statsData.items.length === 0) {
            return res.status(404).json({ error: "Impossible de récupérer les stats de la chaîne." });
        }

        const stats = statsData.items[0].statistics;
        const subscribers = stats.subscriberCount;
        const totalViews = stats.viewCount;
        const totalVideos = stats.videoCount;

        // 3️⃣ Récupérer la dernière vidéo publiée
        const latestVideoUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=1&order=date&type=video&key=${GOOGLE_API_KEY}`;
        const latestVideoResponse = await fetch(latestVideoUrl);
        const latestVideoData = await latestVideoResponse.json();

        let latestVideo = null;
        if (latestVideoData.items && latestVideoData.items.length > 0) {
            latestVideo = {
                videoId: latestVideoData.items[0].id.videoId,
                title: latestVideoData.items[0].snippet.title,
                thumbnail: latestVideoData.items[0].snippet.thumbnails.medium.url,
                url: `https://www.youtube.com/watch?v=${latestVideoData.items[0].id.videoId}`
            };
        }

        // 4️⃣ Récupérer la vidéo la plus populaire
        const popularVideoUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=1&order=viewCount&type=video&key=${GOOGLE_API_KEY}`;
        const popularVideoResponse = await fetch(popularVideoUrl);
        const popularVideoData = await popularVideoResponse.json();

        let popularVideo = null;
        if (popularVideoData.items && popularVideoData.items.length > 0) {
            popularVideo = {
                videoId: popularVideoData.items[0].id.videoId,
                title: popularVideoData.items[0].snippet.title,
                thumbnail: popularVideoData.items[0].snippet.thumbnails.medium.url,
                url: `https://www.youtube.com/watch?v=${popularVideoData.items[0].id.videoId}`
            };
        }

        // ✅ Retourner toutes les informations en JSON
        res.json({
            channelId,
            subscribers,
            totalViews,
            totalVideos,
            latestVideo,
            popularVideo
        });

    } catch (error) {
        console.error("❌ Erreur API YouTube :", error);
        res.status(500).json({ error: "Erreur serveur YouTube." });
    }
});


// ✅ Route pour récupérer des informations sur l'entreprise avec Google Custom Search et OpenAI

app.get("/api/company-info", async (req, res) => {
    const siteInternet = req.query.siteInternet;
    
    if (!siteInternet) {
        return res.status(400).json({ error: "Paramètre 'siteInternet' requis" });
    }

    try {
        console.log(`🔍 Recherche d'informations sur : ${siteInternet}`);

        // 1️⃣ 🔎 Requête Google Custom Search API
        const query = `"${siteInternet}" entreprise OR société OR startup OR industrie OR KPIs OR employés OR effectif OR création`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}`;

        let searchResults;
        try {
            const response = await axios.get(searchUrl);
            searchResults = response.data.items || [];
        } catch (googleError) {
            console.error("❌ Erreur API Google :", googleError.message);
            return res.status(500).json({ error: "Erreur lors de la requête Google." });
        }

        if (!searchResults.length) {
            return res.status(404).json({ error: "Aucune donnée trouvée sur Google." });
        }

        // ✅ Limiter les résultats à 2 pour éviter un prompt trop long
        searchResults = searchResults.slice(0, 2);

        // ✅ Extraire uniquement les informations essentielles des résultats
        const extractedResults = searchResults.map(result => ({
            titre: result.title,
            lien: result.link,
            description: result.snippet // Récupère seulement la description courte
        }));

        // 2️⃣ 📩 Construire le prompt pour OpenAI GPT-4 avec une structure allégée
        const prompt = `
            Voici un résumé des résultats de recherche Google sur "${siteInternet}":
            ${JSON.stringify(extractedResults, null, 2)}

     
            - Synthétiser les informations clés sous forme d'un résumé concis.

            ❗ Attention : Retournez uniquement un JSON bien structuré sans texte supplémentaire :
            {
                               "effectif": "Valeur",
                "année_création": "Valeur",
           
                "dernières_actualités": [
                    {"titre": "...", "source": "..."},
                    {"titre": "...", "source": "..."}
                ],
        
            }
        `;

        // ✅ Vérifier la taille du prompt
        console.log(`🔍 Taille du prompt envoyé à OpenAI : ${prompt.length} caractères`);

        if (prompt.length > 8000) {
            return res.status(400).json({ error: "Le prompt est toujours trop long. Nouvelle réduction nécessaire." });
        }

        // 3️⃣ ✅ Vérifier que la clé OpenAI est bien définie
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ error: "Clé OpenAI manquante" });
        }

        // 4️⃣ 🚀 Appel à OpenAI GPT-4
        try {
            const apiUrl = "https://api.openai.com/v1/chat/completions";

            const aiResponse = await axios.post(apiUrl, {
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 400 // 🔽 Réduction à 400 tokens pour éviter les dépassements
            }, {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 20000 // ⏳ Timeout de 20 secondes
            });

            // ✅ Vérifier si la réponse contient bien un résultat
            if (!aiResponse.data.choices || aiResponse.data.choices.length === 0) {
                return res.status(500).json({ error: "Réponse vide de OpenAI" });
            }

            let responseText = aiResponse.data.choices[0].message.content.trim();

try {
    const finalData = JSON.parse(responseText);
    console.log("✅ Résumé généré par OpenAI :", finalData);
    res.json(finalData);
} catch (jsonError) {
    console.error("❌ Erreur JSON OpenAI :", responseText);
    res.status(500).json({ error: "OpenAI a renvoyé un format non valide. Voici la réponse brute :", raw: responseText });
}


            console.log("✅ Résumé généré par OpenAI :", finalData);

            // 5️⃣ 📤 Retourner les informations interprétées
            res.json(finalData);

        } catch (openAiError) {
            console.error("❌ Erreur API OpenAI :", openAiError.response ? openAiError.response.data : openAiError.message);
            res.status(500).json({ error: "Erreur lors de la requête OpenAI" });
        }

    } catch (error) {
        console.error("❌ Erreur inattendue :", error);
        res.status(500).json({ error: "Erreur interne du serveur." });
    }
});



// ✅ Lancer le serveur
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Serveur en écoute sur http://localhost:${PORT}`);
});