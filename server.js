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



// ✅ Route pour récupérer les actualités sur une entreprise
app.get("/api/company-info", async (req, res) => {
    const companyName = req.query.companyName;
    const companyWebsite = req.query.companyWebsite;
    
    if (!companyName && !companyWebsite) {
        return res.status(400).json({ error: "Paramètres 'companyName' ou 'companyWebsite' requis" });
    }

    try {
        console.log(`🔍 Recherche d'informations sur : ${companyName} | Site : ${companyWebsite}`);

        // ✅ Construire la requête Google Custom Search avec le nom et le site web
        let query = "(";
   
        if (companyWebsite) query += `site:${companyWebsite}`;
        query += ") (actualités OR news OR article OR innovation OR expansion OR financement OR recrutement) after:2024-01-01";

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

        // ✅ Limiter les résultats à 3 articles pour éviter un prompt trop long
        searchResults = searchResults.slice(0, 3);

        // ✅ Extraire uniquement les informations essentielles des résultats
const extractedResults = searchResults.map(result => {
    let imageUrl = result.pagemap?.cse_image?.[0]?.src || result.pagemap?.cse_thumbnail?.[0]?.src || null; // 🖼️ Prend l'image ou une miniature
    let publishedDate = result.pagemap?.metatags?.[0]?.['article:published_time'] || result.snippet.match(/\d{4}-\d{2}-\d{2}/)?.[0] || null; // 📅 Date si dispo

    return {
        titre: result.title,
        source: result.link,
        description: result.snippet,
        image: imageUrl,
        date: publishedDate
    };
});


const prompt = `
    Voici un résumé des résultats de recherche Google sur "${companyName || companyWebsite}":
    ${JSON.stringify(extractedResults, null, 2)}

    - Pour chaque actualité, reformuler une description **courte et claire** en **une seule phrase**.
    - Ne pas reprendre le titre original, mais résumer **le contenu de l'article**.
    - Écrire chaque description **dans la même langue que l'article source**.
    - Si l'article est en français, écrire la description en français.
    - Si l'article est en anglais, écrire la description en anglais.
    - Si la langue de l'article est inconnue, écrire en anglais par défaut.
    - Récupérer l'image et la date de publication si disponibles.
    - Écrire chaque description **dans la langue de l'article**.

    ❗ Attention : Retournez uniquement un JSON bien structuré sans texte supplémentaire :
    {
     "dernières_actualités": [
            {"description": "Résumé de l'actualité", "source": "URL", "image": "URL de l'image", "date": "AAAA-MM-JJ"},
            {"description": "Résumé de l'actualité", "source": "URL", "image": "URL de l'image", "date": "AAAA-MM-JJ"}
        ]
    }
`;



        // ✅ Vérifier la taille du prompt avant d'envoyer à OpenAI
        console.log(`🔍 Taille du prompt OpenAI : ${prompt.length} caractères`);

        if (prompt.length > 8000) {
            return res.status(400).json({ error: "Le prompt est trop long. Nouvelle réduction nécessaire." });
        }

        // 3️⃣ ✅ Vérifier que la clé OpenAI est bien définie
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ error: "Clé OpenAI manquante" });
        }

        // 4️⃣ 🚀 Appel à OpenAI GPT-4
        try {
            const aiResponse = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 400
                },
                {
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 20000 // ⏳ Timeout de 20 secondes
                }
            );

            // ✅ Vérifier si OpenAI a bien généré une réponse
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
                res.status(500).json({ error: "Format de réponse OpenAI non valide.", raw: responseText });
            }
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
