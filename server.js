require("dotenv").config();
require('dotenv').config({ path: '.env' });
const express = require("express");
const axios = require("axios");
const fetch = require("node-fetch");
const cors = require("cors");
const cheerio = require('cheerio');
const fs = require("fs");
const bodyParser = require("body-parser");
const { sequelize, Article } = require("./config/db");
const { Op } = require("sequelize");


const app = express();
const PORT = process.env.PORT || 5000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_TOKEN;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Configuration CORS
app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Vérification des variables d'environnement
console.log(" Vérification des variables d'environnement...");
console.log(" GOOGLE_SEARCH_TOKEN:", GOOGLE_SEARCH_API_KEY ? "OK" : "NON DÉFINI");
console.log(" GOOGLE_SEARCH_CX:", GOOGLE_SEARCH_CX ? "OK" : "NON DÉFINI");
console.log(" BEARER_TOKEN Twitter:", BEARER_TOKEN ? "OK" : "NON DÉFINI");
console.log(" GOOGLE_API_KEY:", GOOGLE_API_KEY ? "OK" : "NON DÉFINI");
console.log(" OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "NON DÉFINI");
console.log(" PERPLEXITY_API_KEY:", process.env.PERPLEXITY_API_KEY ? "OK" : "NON DÉFINI");






// Route principale Twitter
app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
  const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`;

  try {

console.log(" Bearer Token utilisé :", process.env.BEARER_TOKEN);

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
    console.error(" Erreur API Twitter :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Route pour récupérer le Place ID Google
app.get("/api/get-place-id", async (req, res) => {
  const siteInternet = req.query.siteInternet;
  if (!siteInternet) return res.status(400).json({ error: "URL requise" });

  try {
    const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(siteInternet)}&inputtype=textquery&fields=name,place_id,formatted_address&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeSearchUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(" Erreur API Google :", error);
    res.status(500).json({ error: "Erreur serveur Google." });
  }
});









// Route pour récupérer les avis Google
app.get("/api/get-reviews", async (req, res) => {
  const placeId = req.query.placeId;
  if (!placeId) return res.status(400).json({ error: "Place ID requis" });

  try {
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&fields=name,reviews&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placeDetailsUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(" Erreur API Google :", error);
    res.status(500).json({ error: "Erreur serveur Google." });
  }
});

// Route pour récupérer les statistiques complètes de la chaîne YouTube
app.get("/youtube-channel-info", async (req, res) => {
    const channelHandle = req.query.channelHandle; // Ex: "@DigitalFactory"
    if (!channelHandle) {
        return res.status(400).json({ error: "Handle de chaîne requis (ex: @DigitalFactory)" });
    }

    try {
        console.log(` Recherche des infos pour la chaîne YouTube : ${channelHandle}`);

        // Récupérer l'ID de la chaîne via le handle YouTube
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${channelHandle}&key=${GOOGLE_API_KEY}`;
        const handleResponse = await fetch(handleUrl);
        const handleData = await handleResponse.json();

        if (!handleData.items || handleData.items.length === 0) {
            return res.status(404).json({ error: "Aucune chaîne trouvée pour ce handle." });
        }

        const channelId = handleData.items[0].id;
        console.log(` ID de la chaîne trouvé : ${channelId}`);

        // Récupérer les statistiques de la chaîne (abonnés, vues, vidéos)
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

        // Récupérer la dernière vidéo publiée
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

        // Récupérer la vidéo la plus populaire
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

        // Retourner toutes les informations en JSON
        res.json({
            channelId,
            subscribers,
            totalViews,
            totalVideos,
            latestVideo,
            popularVideo
        });

    } catch (error) {
        console.error(" Erreur API YouTube :", error);
        res.status(500).json({ error: "Erreur serveur YouTube." });
    }
});











 // Faire de recherche d'actualités avec Perplexity AI



// Fonction pour récupérer les dernières actualités avec `companyWebsite`
async function getLatestNews(companyWebsite) {
    if (!PERPLEXITY_API_KEY) {
        return { error: "Clé API Perplexity non définie." };
    }

    try {
        console.log(` Recherche des dernières actualités pour : ${companyWebsite}`);

        const response = await axios.post(
            "https://api.perplexity.ai/chat/completions",
    {
        model: "sonar-pro",
        max_tokens: 600,  // Limite la réponse à 600 tokens (ajuste si nécessaire)
        messages: [
            { role: "system", content: "Provide structured, concise responses." },
            { role: "user", content: `Find recent news about ${companyWebsite} from blogs, press releases, or news sources.

            Return only JSON:
          
            {
              "dernières_actualités": [
                {
                  "title": "...", The headline (max **100** characters).
                  "description": "...",  A **short** summary (max **150** characters).
                  "source": "...",  Name of the source (e.g., "BBC News")
                  "url": "...", The **direct** link to the news article (**fully valid and untruncated**
                  "date": "...",  Format: YYYY-MM-DD
                  "tags": ["..."], Up to Relevant tags like "Funding", "Acquisition", "New Product"
                }
              ]
            }

       
            - Limit response to 3 items.` }
        ]
    },
            {
                headers: {
                    "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        if (!response.data || !response.data.choices) {
            return { error: "Réponse invalide de Perplexity AI" };
        }

        // Vérification et parsing de la réponse
        const parsedResponse = response.data.choices[0].message.content;
        try {
            const newsData = JSON.parse(parsedResponse);
            return newsData;
        } catch (jsonError) {
            console.error(" Erreur de parsing JSON :", parsedResponse);
            return { error: "Format de réponse non valide." };
        }

    } catch (error) {
        console.error(" Erreur API Perplexity :", error.response ? error.response.data : error.message);
        return { error: "Erreur API Perplexity" };
    }
}



// Route API pour récupérer les actualités d'une entreprise avec `companyWebsite`
app.get("/api/company-info", async (req, res) => {
    const companyWebsite = req.query.companyWebsite;

    if (!companyWebsite) {
        return res.status(400).json({ error: "Paramètre 'companyWebsite' requis" });
    }

    const news = await getLatestNews(companyWebsite);
    res.json(news);
});







// Gestion des Feedbacks (Like / Dislike) avec persistance

const feedbackFile = "feedback.json";

// Activer CORS pour éviter les problèmes avec Shopify ou d'autres domaines
app.use(bodyParser.json()); // Permet de lire les requêtes JSON

// Charger les votes sauvegardés
let feedback = { likes: 0, dislikes: 0 };
if (fs.existsSync(feedbackFile)) {
    try {
        feedback = JSON.parse(fs.readFileSync(feedbackFile, "utf-8"));
    } catch (err) {
        console.error(" Erreur lors du chargement des votes :", err);
    }
}

// Route GET : Récupérer les votes
app.get("/api/feedback", (req, res) => {
    res.json(feedback);
});

// Route POST : Mettre à jour les votes
app.post("/api/feedback", (req, res) => {
    const { type } = req.body;

    if (!type || (type !== "like" && type !== "dislike")) {
        return res.status(400).json({ error: "Type invalide" });
    }

    if (type === "like") feedback.likes++;
    if (type === "dislike") feedback.dislikes++;

    try {
        fs.writeFileSync(feedbackFile, JSON.stringify(feedback, null, 2));
        res.json(feedback);
    } catch (error) {
        console.error(" Erreur lors de la sauvegarde :", error);
        res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }

});








// Route API pour rechercher des actualités avec Perplexity


(async () => {
  try {
    await sequelize.authenticate();
await sequelize.sync(); // 🔄 Assure-toi que les tables sont bien synchronisées
    console.log("✅ Connexion réussie à PostgreSQL avec Sequelize");
  } catch (error) {
    console.error("❌ Erreur de connexion à PostgreSQL :", error);
    process.exit(1); // 🔥 Arrête le serveur en cas d'échec
  }
})();




// 🔥 Fonction pour récupérer les actualités depuis Perplexity API

async function fetchLatestNews() {
  if (!PERPLEXITY_API_KEY) {
    return { error: "Clé API Perplexity non définie." };
  }

  try {
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
    {
        model: "sonar-pro",
        max_tokens: 800,  // Limite la réponse à 600 tokens (ajuste si nécessaire)
        messages: [
            { role: "system", content: "Provide structured, concise responses." },
            { role: "user", content: `Donne-moi uniquement les derniers articles de presse publiés aujourd’hui dans les 3 dernières heures sur les sujets suivants :  
- Industrie 4.0 en France  
- Applications industrielles  
- IoT industriel  
- Automatisation et digitalisation de l'industrie  
- Levée de fonds dans l'industrie  
- Acquisitions et fusions d'entreprises industrielles  
- Lancement de nouveaux produits industriels  
- Partenariats stratégiques entre entreprises industrielles  
- Salons et événements industriels en cours ou à venir  

Instructions importantes :  
- Ne retourne que des articles publiés aujourd’hui dans les 3 dernières heures.  
- N'inclus aucun article plus ancien ou publié en dehors de cette période.  
- Priorise les sources fiables et reconnues.  
- Ne renvoie que des articles uniques (aucun doublon).  
- Réponds uniquement avec du JSON strictement valide dans ce format :  

          
            {
              "articles": [
                {
     "title": "...",
      "description": "...",
      "image": "...",
      "tags": ["...", "..."],
      "date": "YYYY-MM-DD",
      "source": "...",
      "url": "...",
      "language": "..."
    }
              ]
            }

       
            - Limiter les répondes à 3 articles.` }
        ]
    },
            {
                headers: {
                    "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );


    if (!response.data || !response.data.choices) {
      throw new Error("Réponse invalide de Perplexity AI");
    }

    const parsedResponse = JSON.parse(response.data.choices[0].message.content);

    console.log("📥 Articles récupérés depuis Perplexity :", parsedResponse.articles);
    console.log("🔍 Réponse brute de Perplexity :", response.data);
const rawContent = response.data.choices[0].message.content;
console.log("RAW message content:", rawContent);


    return parsedResponse.articles || [];
  } catch (error) {
    console.error("❌ Erreur API Perplexity :", error.message);
    return [];
  }
}

// 🔄 Mise à jour automatique des articles
async function updateArticles() {
  const articles = await fetchLatestNews();
  if (!articles.length) {
    console.log("🛑 Perplexity n'a renvoyé aucun article.");
    return;
  }

  for (const article of articles) {
    await Article.findOrCreate({
      where: { url: article.url },
      defaults: article,
    });
  }
  console.log("✅ Articles mis à jour !");
  
  const count = await Article.count();
  console.log("📊 Nombre total d'articles enregistrés en base :", count);
}

// 🏁 Appeler la première fois immédiatement
updateArticles();

// 🔄 Puis répéter toutes les 3 heures
setInterval(updateArticles, 3 * 60 * 60 * 1000);




setInterval(updateArticles, 3 * 60 * 60 * 1000); // Actualisation toutes les 3h

// 📢 Route API pour récupérer les articles avec filtres généraux
app.get("/api/articles", async (req, res) => {
  try {
    const { category, tag, language } = req.query;
    let whereClause = {};

    if (category) whereClause.tags = { [Op.contains]: [category] };
    if (tag) whereClause.tags = { [Op.contains]: [tag] };
    if (language) whereClause.language = language;

    const articles = await Article.findAll({ where: whereClause, order: [["date", "DESC"]] });
    res.json(articles);
  } catch (error) {
    console.error("❌ Erreur récupération articles :", error.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Route API pour récupérer les articles en fonction de la langue de Shopify
app.get("/api/articles/shopify", async (req, res) => {
  try {
    const { shopifyLang, tag } = req.query;
    const language = shopifyLang || "en";

    let whereClause = { language };
    if (tag) {
      whereClause.tags = { [Op.contains]: [tag] };
    }

    const articles = await Article.findAll({
      where: whereClause,
      order: [["date", "DESC"]], // plus récent en premier
    });

    res.json(articles);
  } catch (error) {
    console.error("❌ Erreur récupération articles Shopify :", error.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Route API pour filter les articles en fonction de tags
app.get("/api/tags", async (req, res) => {
  try {
    // On ne récupère que la colonne "tags"
    const articles = await Article.findAll({
      attributes: ["tags"] // Uniquement la colonne "tags"
    });

    // On met tous les tags dans un Set (pour éviter les doublons)
    const allTags = new Set();
    articles.forEach(article => {
      if (article.tags && Array.isArray(article.tags)) {
        article.tags.forEach(tag => allTags.add(tag));
      }
    });

    // On renvoie le tableau de tags uniques
    const uniqueTags = [...allTags];
    res.json(uniqueTags);
  } catch (error) {
    console.error("Erreur lors de la récupération des tags :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Lancer le serveur Express
app.listen(PORT, () => {
    console.log(` Serveur en écoute sur http://localhost:${PORT}`);
});





