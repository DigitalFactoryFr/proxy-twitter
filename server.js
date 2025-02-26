require("dotenv").config();
require('dotenv').config({ path: '.env' });
const express = require("express");
const axios = require("axios");
const fetch = require("node-fetch");
const cors = require("cors");
const cheerio = require('cheerio');
const fs = require("fs");
const bodyParser = require("body-parser");
const { sequelize, Article, Feedback } = require("./config/db");
const { Op } = require("sequelize");


const app = express();
const PORT = process.env.PORT || 5000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_TOKEN;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

app.use(express.json());  
app.use(express.urlencoded({ extended: true })); 

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

console.log("📌 Vérification Feedback :", Feedback);

// Route GET : Récupérer les votes
app.get("/api/feedback", async (req, res) => {
    try {
        const feedback = await Feedback.findOne({ where: { id: 1 } });
        res.json(feedback || { likes: 0, dislikes: 0 });
    } catch (error) {
        console.error("❌ Erreur récupération feedback :", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Route POST : Mettre à jour les votes
app.post("/api/feedback", async (req, res) => {
    const { type } = req.body;
    if (!type || (type !== "like" && type !== "dislike")) {
        return res.status(400).json({ error: "Type invalide" });
    }

    try {
        const feedback = await Feedback.findOne({ where: { id: 1 } });
        if (!feedback) {
            await Feedback.create({ likes: 0, dislikes: 0 });
        }

        if (type === "like") {
            await Feedback.increment("likes", { where: { id: 1 } });
        } else if (type === "dislike") {
            await Feedback.increment("dislikes", { where: { id: 1 } });
        }

        const updatedFeedback = await Feedback.findOne({ where: { id: 1 } });
        res.json(updatedFeedback);
    } catch (error) {
        console.error("❌ Erreur mise à jour feedback :", error);
        res.status(500).json({ error: "Erreur serveur" });
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

async function getExistingArticles() {
    try {
        const { data } = await axios.get("https://digitalfactory.store/pages/actualites");
        const $ = cheerio.load(data);
        let existingUrls = [];

        // Sélectionne les URLs des articles (adapte le sélecteur en fonction de la structure de ta page)
        $("a.article-link").each((i, el) => {
            existingUrls.push($(el).attr("href"));
        });

        return new Set(existingUrls); // Convertir en Set pour filtrer facilement
    } catch (error) {
        console.error("❌ Impossible de récupérer les articles existants :", error.message);
        return new Set(); // Retourne un Set vide en cas d'erreur
    }
}

async function fetchLatestNews() {
  if (!PERPLEXITY_API_KEY) {
    return { error: "Clé API Perplexity non définie." };
  }

  try {

const existingArticles = await Article.findAll({
    attributes: ['url', 'title']
});
const seenArticles = new Set(existingArticles.map(a => a.url));

const now = new Date(); // Obtenir la date actuelle
const currentHour = now.getHours(); // Heure actuelle
const day = now.getDate(); // Jour du mois
const month = now.getMonth() + 1; // Mois (en JavaScript, le mois commence à 0)
const year = now.getFullYear(); // Année



// Format de la date sous forme de "JJ/MM/AAAA"
const formattedDate = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;

// Plage horaire
let blockStart = currentHour - 3;
if (blockStart < 0) {
  blockStart = 0; // Gérer les heures négatives si nécessaire
}

// Créer le texte de la plage horaire
const dateRangeText = `${formattedDate} entre ${blockStart}h et ${currentHour}h`;


console.log(dateRangeText);
console.log("🔍 Articles déjà affichés :", seenArticles);
const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
    {
        model: "sonar-pro",
        max_tokens: 3000,  // Limite la réponse à 3000 tokens (ajuste si nécessaire)

        messages: [
            { role: "system", content: "Fournissez des réponses structurées et concises." },
            { role: "user", content: `Récupérez les articles de presse et articles de blog publiés uniquement le ${formattedDate}, sur les sujets suivants :  

 
- SaaS industriels
- IoT industriel
- Automatisation et transformation digitale dans le secteur industriel
- Industrie 4.0 en France
- Levée de fonds pour les startups industrielles
- Acquisition et achat d'entreprises industrielles
- Nouvelles nominations au sein des grands groupes industriels

Instructions importantes :  
- Fournir jusqu'à 10 articles uniques et pertinents.
- Tous les articles doivent provenir de sources reconnues et avoir une URL valide.
- Retourner uniquement les articles publiés le ${formattedDate}.  
- Exclure les articles qui ne correspondent pas aux critères de date.
- Tous les articles doivent être uniques (pas de doublons).
- Chaque article doit être traité uniquement dans sa langue d'origine.
- Prioriser les articles les plus récents et strictement liés aux sujets demandés avant d’élargir la recherche si nécessaire.
- Incluez une diversité maximale dans les sujets abordés, sans répétition.  
- Extraire les noms des entreprises mentionnées dans les articles et les lister dans le champ "companies".  
- Générer les tags en fonction de la langue de l'article (exemple : "Automation" en anglais, "Automatisation" en français).  
- Répondre strictement en JSON valide au format suivant :  

          
            {
              "articles": [
                {
     "title": "...",
      "description": "...",
      "image": "URL de l'image",
      "tags": ["...", "..."],
      "date": "YYYY-MM-DD HH:mm:ss",
      "source": "...",
      "url": "...",
      "language": "...", 
	"companies": ["...","..."]
    }
              ]
            }

       
            ` }
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
const rawContent = response.data.choices[0].message.content;
console.log("🔍 Contenu brut de la réponse Perplexity :", rawContent);

let parsedResponse;
try {
    // Trouver la position du premier { pour extraire uniquement le JSON
    const jsonStart = rawContent.indexOf("{");
    if (jsonStart === -1) {
        throw new Error("Aucun JSON détecté dans la réponse !");
    }

    const jsonString = rawContent.slice(jsonStart); // On prend tout à partir du premier '{'

    parsedResponse = JSON.parse(jsonString);

    if (!parsedResponse.articles || !Array.isArray(parsedResponse.articles)) {
        throw new Error("Le champ 'articles' est manquant ou mal formaté !");
    }
} catch (error) {
    console.error("❌ La réponse Perplexity n'est pas un JSON valide :", error.message);
    return [];
}

const hasGermanArticle = parsedResponse.articles.some(article => article.language === "de");

        if (hasGermanArticle) {
            console.log("✅ Un article en allemand est bien récupéré !");
        } else {
            console.warn("⚠️ Aucun article en allemand trouvé dans la réponse !");
        }
console.log("📥 Articles récupérés depuis Perplexity :", parsedResponse.articles);
console.log("🔍 Réponse brute complète :", JSON.stringify(response.data, null, 2));
console.dir(response.data, { depth: null, colors: true });

return parsedResponse.articles || [];
} catch (error) {
    console.error("❌ Erreur API Perplexity :", error.message);
    return [];
}
}

// 🔄 Mise à jour automatique des articles


async function updateArticles() {
  const articles = await fetchLatestNews(); // <--- votre fonction qui appelle Perplexity
  if (!articles.length) {
    console.log("🛑 Perplexity n'a renvoyé aucun article.");
    return;
  }

  console.log("📌 Articles prêts pour l'enregistrement :", articles.map(a => `${a.language}: ${a.title}`).join("\n"));


      

  for (const article of articles) {
    // Vérifier / compléter l'image si besoin
    
  console.log(`🔍 Vérification : ${article.title} | Langue: ${article.language}`);

        if (article.language === "de") {
            console.log("✅ Article en allemand détecté :", article.title);
        }

if (!article.image) {
      article.image = await fetchArticleImage(article.url); 
    }

    // Sauvegarder en base
    // => findOrCreate ou upsert, selon votre logique
    await Article.findOrCreate({
      where: { url: article.url },
      defaults: {
        title:       article.title,
        description: article.description,
        source:      article.source,
        date:        article.date,
        url:         article.url,
        image:       article.image,
        language:    article.language,
        tags: Array.isArray(article.tags) ? article.tags : [],
        companies:   article.companies,
      },
    });
  }



    console.log("✅ Articles mis à jour !");

  const count = await Article.count();
  console.log("📊 Nombre total d'articles enregistrés en base :", count);
}





// 🏁 Appeler la première fois immédiatement
updateArticles();

// 🔄 Puis répéter toutes les 2 heures
setInterval(updateArticles, 15 * 60 * 1000); // Actualisation toutes les 15 minutes


// 📢 Route API pour récupérer les articles avec filtres généraux

app.get("/api/articles/shopify", async (req, res) => {
  try {
    // On récupère shopifyLang et autres filtres
    const {
      shopifyLang,
      tag,
      source,
      company,
      search,
      dateRange,
      startDate,
      endDate
    } = req.query;

    // Langue par défaut = "en" si non spécifié
    const language = shopifyLang || "en";

    // whereClause impose la langue
    let whereClause = { language };

    // 1) Filtre par tag exact
    if (tag) {
      whereClause.tags = { [Op.contains]: [tag] };
    }

    // 2) Filtre par source (partiel, insensible à la casse)
    if (source) {
      whereClause.source = { [Op.iLike]: `%${source}%` };
    }

    // 3) Gestion des dates (période)
    if (dateRange && dateRange !== "custom") {
      const now = new Date();
      let start = null;
      let end = new Date();

      switch (dateRange) {
        case "today": {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          break;
        }
        case "this_week": {
          const dayOfWeek = now.getDay(); 
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          start = new Date(now.setDate(diff));
          start.setHours(0, 0, 0, 0);
          break;
        }
        case "this_month": {
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          break;
        }
        case "this_year": {
          start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
          break;
        }
      }

      if (start) {
        whereClause.date = { [Op.between]: [start, end] };
      }
    }

    if (dateRange === "custom" && startDate && endDate) {
      whereClause.date = {
        [Op.between]: [ new Date(startDate), new Date(endDate) ]
      };
    }

    // 4) Requête initiale : on récupère tous les articles correspondant au whereClause
    let articles = await Article.findAll({
      where: whereClause,
      order: [["date", "DESC"]]
    });

    // 5) 🔎 Recherche partielle par mot-clé (titre, desc, tags)
    if (search) {
      const s = search.toLowerCase();
      articles = articles.filter(a => {
        const inTitle = a.title?.toLowerCase().includes(s);
        const inDesc  = a.description?.toLowerCase().includes(s);
        const inTags  = (a.tags || []).some(tagItem => tagItem.toLowerCase().includes(s));
        return inTitle || inDesc || inTags;
      });
    }

    // 6) 🔎 Recherche partielle par "company" (dans le tableau companies)
    if (company) {
      const c = company.toLowerCase();
      articles = articles.filter(a => {
        return (a.companies || []).some(comp => comp.toLowerCase().includes(c));
      });
    }

    // 7) Retourner la liste finale
    res.json(articles);

  } catch (error) {
    console.error("❌ Erreur récupération articles Shopify :", error.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



// 📌 Route API pour récupérer les articles en fonction de la langue de Shopify

app.get("/api/articles/shopify", async (req, res) => {
  try {
    // On récupère shopifyLang et autres filtres
    const {
      shopifyLang,
      tag,
      source,
      company,
	search, 
      dateRange,
      startDate,
      endDate
    } = req.query;

    // Langue par défaut = "en" si non spécifié
    const language = shopifyLang || "en";

    // whereClause impose la langue
    let whereClause = { language };

  // 🔎 1) Recherche partielle par mot-clé (titre, desc, tags)
    if (search) {
      const s = search.toLowerCase();
      articles = articles.filter(a => {
        const inTitle = a.title?.toLowerCase().includes(s);
        const inDesc  = a.description?.toLowerCase().includes(s);
        const inTags  = (a.tags || []).some(tag => tag.toLowerCase().includes(s));
        return inTitle || inDesc || inTags;
      });
    }

    // Filtre par tag
    if (tag) {
      whereClause.tags = { [Op.contains]: [tag] };


    }

    // Filtre par source
    if (source) {
      whereClause.source = { [Op.iLike]: `%${source}%` };
    }


      // 🔎 2) Recherche partielle par "company" (tableau)
    if (company) {
      const c = company.toLowerCase();
      articles = articles.filter(a => {
        return (a.companies || []).some(comp => comp.toLowerCase().includes(c));
      });
    }

    // Gestion des dates
    if (dateRange && dateRange !== "custom") {
      const now = new Date();
      let start = null;
      let end = new Date();

      switch (dateRange) {
        case "today": {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          break;
        }
        case "this_week": {
          const dayOfWeek = now.getDay();
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          start = new Date(now.setDate(diff));
          start.setHours(0, 0, 0, 0);
          break;
        }
        case "this_month": {
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          break;
        }
        case "this_year": {
          start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
          break;
        }
      }

      if (start) {
        whereClause.date = { [Op.between]: [start, end] };
      }
    }

    if (dateRange === "custom" && startDate && endDate) {
      whereClause.date = {
        [Op.between]: [ new Date(startDate), new Date(endDate) ]
      };
    }

    // Requête
    const articles = await Article.findAll({
      where: whereClause,
      order: [["date", "DESC"]], // plus récents en premier
    });

    res.json(articles);
  } catch (error) {
    console.error("❌ Erreur récupération articles Shopify :", error.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});




// 📌 Route API pour récupérer les tags en fonction de la langue Shopify

app.get("/api/tags", async (req, res) => {
  try {
    const { shopifyLang } = req.query;
    const language = shopifyLang || "en"; // Par défaut, l'anglais

    // Récupérer uniquement les tags des articles de la langue
    const articles = await Article.findAll({
      attributes: ["tags"],
      where: { language }, 
    });

    // Extraire tous les tags
    const allTags = new Set();
    articles.forEach(article => {
      if (Array.isArray(article.tags)) {
        article.tags.forEach(tag => allTags.add(tag));
      }
    });

    // Conversion en tableau
    res.json([...allTags]);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des tags :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// 📌 Route API pour récupérer les entreprises (companies) en fonction de la langue Shopify
app.get("/api/companies", async (req, res) => {
  try {
    const { shopifyLang } = req.query;
    const language = shopifyLang || "en"; // Par défaut, l'anglais

    // Récupérer uniquement la liste des companies pour les articles de la langue
    const articles = await Article.findAll({
      attributes: ["companies"],
      where: { language },
    });

    // Extraire toutes les entreprises et les rendre uniques
    const allCompanies = new Set();
    articles.forEach(article => {
      if (Array.isArray(article.companies)) {
        article.companies.forEach(company => allCompanies.add(company));
      }
    });

    // Convertir en tableau et renvoyer la réponse
    res.json([...allCompanies]);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des companies :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



//2️⃣ Extraire l'image principale de l'article



async function fetchArticleImage(url) {
    try {
        const { data } = await axios.get(url, { timeout: 5000 });
        const $ = cheerio.load(data);
        let imageUrl = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content');

        return imageUrl || ""; // Retourne une image si trouvée, sinon une chaîne vide
    } catch (error) {
        console.error("❌ Impossible de récupérer l'image :", error.message);
        return "";
    }
}


// Lancer le serveur Express
app.listen(PORT, () => {
    console.log(` Serveur en écoute sur http://localhost:${PORT}`);
});





