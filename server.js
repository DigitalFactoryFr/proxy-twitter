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

console.log(`🚀 Serveur démarré à ${new Date().toISOString()}`);


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

async function isUrlValid(url) {
    try {
        const response = await axios.get(url, { timeout: 8000, maxRedirects: 5 });
        return response.status >= 200 && response.status < 500; // Accepte les 2xx, 3xx et 4xx (sauf 404)
    } catch (error) {
        return false; // L'URL est invalide si la requête échoue
    }
}



async function deleteInvalidArticles() {
    console.log("🔍 Vérification des articles en base...");

    const articles = await Article.findAll(); // Récupère tous les articles
    for (const article of articles) {
        const isStillValid = await isUrlValid(article.url);
        
        if (!isStillValid) {
            console.warn(`🟠 Vérification supplémentaire pour : ${article.title}`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Attendre 3s avant un deuxième test

            const recheck = await isUrlValid(article.url);
            if (!recheck) {
                console.log(`🗑️ Suppression article: ${article.title} (URL invalide)`);
                await Article.destroy({ where: { id: article.id } });
            } else {
                console.log(`✅ Article conservé après seconde vérification: ${article.title}`);
            }
        }
    }

    console.log("✅ Nettoyage terminé.");
}



// 🔥 Fonction pour récupérer les actualités existantes depuis votre page actualités
async function getExistingArticles() {
  try {
    const { data } = await axios.get("https://digitalfactory.store/pages/actualites");
    const $ = cheerio.load(data);
    let existingUrls = [];

    // Sélectionne les URLs des articles (adaptez le sélecteur en fonction de la structure de votre page)
    $("a.article-link").each((i, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absoluteUrl = new URL(href, "https://digitalfactory.store").toString();
        existingUrls.push(absoluteUrl);
      }
    });

    return new Set(existingUrls); // Convertir en Set pour filtrer facilement
  } catch (error) {
    console.error("❌ Impossible de récupérer les articles existants :", error.message);
    return new Set(); // Retourne un Set vide en cas d'erreur
  }
}

// 🔥 Fonction générique pour envoyer un prompt à Perplexity API
async function sendPrompt(topicText) {
  if (!PERPLEXITY_API_KEY) {
    console.error("❌ Clé API Perplexity non définie.");
    return [];
  }

  // Calcul de la date et de la plage horaire
  const now = new Date();
  const currentHour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const formattedDate = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;
  let blockStart = currentHour - 3;
  if (blockStart < 0) {
    blockStart = 0; // Gérer les heures négatives si nécessaire
  }
  const dateRangeText = `${formattedDate} entre ${blockStart}h et ${currentHour}h`;
  console.log(dateRangeText);

  // Récupérer les articles déjà en base pour éviter les doublons
  const existingArticles = await Article.findAll({ attributes: ['url', 'title'] });
  const seenArticles = new Set(existingArticles.map(a => a.url));
  console.log("🔍 Articles déjà affichés :", seenArticles);

  // Texte complet du prompt (stocké dans une constante) en y intégrant la date
  const prompt = `${topicText}


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
      "companies": ["...", "..."]
    }
  ]
}`;

  console.log("✉️ Envoi du prompt :", prompt);

  try {
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar-pro",
        max_tokens: 3000,
        messages: [
          { role: "system", content: "Fournissez des réponses structurées et concises." },
          { role: "user", content: prompt }
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
      // Extraire le JSON à partir du premier '{'
      const jsonStart = rawContent.indexOf("{");
      if (jsonStart === -1) {
        throw new Error("Aucun JSON détecté dans la réponse !");
      }
      const jsonString = rawContent.slice(jsonStart);
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


// 🔄 Fonction qui enchaîne plusieurs prompts séquentiellement
async function executeNewsPrompts() {
   // Calcul de la date et de la plage horaire
  const now = new Date();
  const currentHour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const formattedDate = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;
  let blockStart = currentHour - 24;
  if (blockStart < 0) {
    blockStart = 0; // Gérer les heures négatives si nécessaire
  }
  const dateRangeText = `${formattedDate} entre ${blockStart}h et ${currentHour}h`;
  console.log(dateRangeText);


  // Définition des sujets pour chaque prompt
  const prompts = [



// 2e prompt : Fusions, acquisitions et alliances stratégiques

`
Récupérez les articles publiés le ${formattedDate} sur les opérations stratégiques dans l’industrie, ainsi que les autres actualités majeures du secteur.

Instructions importantes :  
- Fournir jusqu'à 10 articles uniques et pertinents.  
- Tous les articles doivent provenir de sources reconnues et fiables et avoir une URL valide.  
- Retourner uniquement les articles publiés le ${formattedDate}.  
- Exclure les articles qui ne correspondent pas aux critères de date.  
- Tous les articles doivent être uniques (pas de doublons).  
- Chaque article doit être traité uniquement dans sa langue d'origine.  
- Extraire les noms des entreprises mentionnées dans les articles et les lister dans le champ "companies".  
- Générer les tags en fonction de la langue de l'article (exemple : "Investissement", "Startup industrielle", "Industrie 4.0").  
- Répondre strictement en JSON valide au format suivant :  
 
`,




// 1st prompt: Strategic Operations in Industry  

`
Retrieve articles published on ${formattedDate} about strategic operations in the industry, as well as other major industry news.  

Important Instructions:  
- Provide up to 10 unique and relevant articles.  
- All articles must come from recognized and reliable sources with a valid URL.  
- Return only articles published on ${formattedDate}.  
- Exclude articles that do not match the specified date criteria.  
- All articles must be unique (no duplicates).  
- Each article should be processed only in its original language.  
- Extract company names mentioned in the articles and list them in the "companies" field.  
- Generate tags based on the article's language (e.g., "Investment," "Industrial Startup," "Industry 4.0").  
- Respond strictly in valid JSON format as follows:  

`,  


  ];



  // Parcourir chaque prompt et traiter la réponse avant de passer au suivant
  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n=== Exécution du prompt ${i + 1} ===`);
    const articles = await sendPrompt(prompts[i]);
    console.log(`📥 Articles récupérés pour le prompt ${i + 1} :`, articles);

    for (const article of articles) {
      console.log(`🔍 Vérification : ${article.title} | Langue: ${article.language}`);

	if (["fr", "fr-FR", "fr-CA"].includes(article.language)) {
    console.log(`✅ Article en français détecté : ${article.title}`);
}



      if (article.language === "de") {
        console.log("✅ Article en allemand détecté :", article.title);
      }

      if (!article.image) {
        article.image = await fetchArticleImage(article.url);
      }

      // Sauvegarde en base de données (utilisez findOrCreate ou upsert selon votre logique)
           console.log(`🔍 Vérification : ${article.title} | URL: ${article.url}`);

      // Vérifier si l'URL est valide avant d'insérer
      if (!await isUrlValid(article.url)) {
          console.log(`❌ URL invalide, article ignoré: ${article.url}`);
          continue; // On passe à l'article suivant
      }

      // Vérifier si l'article existe déjà en base
      const [savedArticle, created] = await Article.findOrCreate({
          where: { url: article.url },
          defaults: {
              title: article.title,
              description: article.description,
              source: article.source,
              date: article.date,
              url: article.url,
              image: article.image || await fetchArticleImage(article.url),
              language: article.language,
              tags: Array.isArray(article.tags) ? article.tags : [],
              companies: article.companies,
          },
      });

      if (created) {
          console.log(`✅ Article ajouté: ${article.title}`);
      } else {
          console.log(`🔄 Article déjà en base: ${article.title}`);
      }

    }
  }
  console.log("✅ Tous les prompts ont été exécutés et les articles mis à jour !");
  const count = await Article.count();
  console.log("📊 Nombre total d'articles enregistrés en base :", count);
}


// Lancement de la séquence des prompts
executeNewsPrompts();

async function updateArticles() {


console.log("🔄 Mise à jour des articles en cours...");

console.log(`🔄 Exécution de updateArticles() à ${new Date().toISOString()}`);


  // Exécuter la récupération des articles
  await executeNewsPrompts();

  console.log("✅ Mise à jour des articles terminée !");

await deleteInvalidArticles(); // 🔥 Nettoie les articles avec des URLs non valides
 console.log("✅ Nettoyage des articles terminé !");
}



// 🏁 Appeler la première fois immédiatement
updateArticles();

// 🔄 Puis répéter toutes les 12 heures
setInterval(updateArticles, 12 * 60 * 60 * 1000); // Actualisation toutes les 3 heures


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


app.post("/api/submit-article", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: "❌ Aucune URL fournie." });

  console.log(`🔍 Vérification de l'URL soumise : ${url}`);

  // Vérification si l'URL est valide
  if (!await isUrlValid(url)) {
    return res.status(400).json({ message: "❌ L'URL semble invalide ou inaccessible." });
  }

  // On construit le prompt
  const prompt = `
Analysez l'article provenant de cette URL : ${url}.
    
Critères stricts : L'article doit obligatoirement respecter tous ces critères :

  - Publié ce mois-ci (rejeter si la date n'est pas claire ou trop ancienne).
  - Issu d'une source fiable : Presse économique, blogs spécialisés, médias d'analyse industrielle.
  - L'article doit couvrir l'un des sujets suivants :
    - Levées de fonds industrielles (startups et entreprises industrielles).
    - Fusions et acquisitions dans le secteur industriel.
    - Lancements de nouveaux produits industriels (équipements, machines, robots, capteurs, logiciels).
    - Lancements de nouvelles applications ou logiciels industriels (ERP, MES, IoT, IA).
    - Partenariats stratégiques entre entreprises industrielles.
    - Innovations disruptives (technologies révolutionnaires, nouveaux business models).
    - Salons et conférences industrielles (Hannover Messe, Web Summit, CES, VivaTech).
    - Nominations de nouveaux dirigeants dans des entreprises industrielles majeures.
    - Partenariats stratégiques : collaborations entre startups et grands groupes industriels
    - Événements sectoriels (automobile, aérospatial, supply chain, maintenance prédictive, robotisation).
    - Et autres actualités majeures du secteur industriel.

Instructions importantes :
- Générer les tags en fonction de la langue de l'article (exemple : "Investissement", "Startup industrielle", "Industrie 4.0").
- Chaque article doit être traité uniquement dans sa langue d'origine.  
- Extraire les noms des entreprises mentionnées dans les articles et les lister dans le champ "companies".       
- Retournez uniquement les informations sous format JSON strictement valide :

    {
      "title": "Titre de l'article",
      "description": "Résumé de l'article",
      "image": "URL de l'image",
      "tags": ["tag1", "tag2"],
      "date": "YYYY-MM-DD HH:mm:ss",
      "source": "Nom du site",
      "url": "${url}",
      "language": "...",
      "companies": ["Entreprise1", "Entreprise2"],
      "pertinence_score": 8
    }
  `;

  try {
    // Appel à l'API Perplexity
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar-pro",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      },
      { headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" } }
    );

    // On stocke la réponse brute dans rawResponse
    const rawResponse = response.data.choices[0].message.content;
    console.log("🔍 Réponse brute Perplexity :", rawResponse);

    let parsedResponse;
    try {
      const jsonStart = rawResponse.indexOf("{");
      if (jsonStart === -1) throw new Error("Aucun JSON détecté !");
      parsedResponse = JSON.parse(rawResponse.slice(jsonStart));

      // On vérifie quelques champs obligatoires
      if (!parsedResponse.title || !parsedResponse.url || !parsedResponse.pertinence_score) {
        throw new Error("JSON mal formaté !");
      }
    } catch (error) {
      console.error("❌ Réponse Perplexity invalide :", error.message);
      // On renvoie rawResponse dans tous les cas
      return res.status(500).json({
        message: "❌ Erreur de format JSON.",
        rawResponse // <-- On renvoie la réponse brute pour l'afficher côté front
      });
    }

    // Vérification du score de pertinence
    if (parsedResponse.pertinence_score < 6) {
      return res.status(400).json({
        message: "❌ L'article a été jugé comme peu pertinent.",
        rawResponse: rawResponse // On renvoie la réponse brute
      });
    }

    // Vérification de la récence de l’article
    const articleDate = new Date(parsedResponse.date);
    const today = new Date();
    if (
      articleDate.getFullYear() !== today.getFullYear() ||
      articleDate.getMonth() !== today.getMonth()
    ) {
      return res.status(400).json({
        message: "❌ L'article n'est pas récent (doit être publié ce mois-ci).",
        rawResponse: rawResponse
      });
    }

    // Vérification de la pertinence industrielle
    const industrialKeywords = ["industrie", "usine", "supply chain", "robotique", "automatisation", "manufacturing", "industrie 4.0"];
    const relevant = industrialKeywords.some(keyword =>
      parsedResponse.description.toLowerCase().includes(keyword) ||
      parsedResponse.title.toLowerCase().includes(keyword)
    );

    if (!relevant) {
      return res.status(400).json({
        message: "❌ L'article ne traite pas d'un sujet industriel.",
        rawResponse: rawResponse
      });
    }

    // Vérifier si l'article existe déjà en base
    const [article, created] = await Article.findOrCreate({
      where: { url },
      defaults: parsedResponse
    });

    return res.json({
      message: created ? "✅ Article validé et publié !" : "🔄 Article déjà existant.",
      rawResponse,        // On renvoie toujours la réponse brute
      data: parsedResponse
    });

  } catch (error) {
    console.error("❌ Erreur API Perplexity :", error.message);
    return res.status(500).json({
      message: "❌ Erreur lors de l'analyse de l'article.",
      rawResponse: error.message
    });
  }
});


async function isUrlValid(url) {
  try {
    const response = await axios.get(url, { timeout: 8000, maxRedirects: 5 });
    return response.status >= 200 && response.status < 500; // Accepte les statuts 2xx et 3xx
  } catch (error) {
    return false; // L'URL est invalide si la requête échoue
  }
}



//2️⃣ Extraire l'image principale de l'article


// Exemple de fonction d'extraction d'image avec Cheerio
async function fetchArticleImage(url) {
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);
    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content');

    // Retourne l'URL trouvée, sinon chaîne vide
    return imageUrl || "";
  } catch (error) {
    console.error("❌ Impossible de récupérer l'image :", error.message);
    return "";
  }
}

// Fonction pour mettre à jour les articles qui ont l'image par défaut
async function updateExistingArticlesImages() {
  try {
    // Récupère tous les articles dont l'image est encore celle par défaut
    const articles = await Article.findAll({
      where: {
        image: "https://digitalfactory.store/default-image.jpg"
      }
    });

    for (const article of articles) {
      console.log(`🔄 Mise à jour de l'image pour: ${article.title}`);
      
      // Extraction de la vraie URL d'image
      const imageUrl = await fetchArticleImage(article.url);

      if (imageUrl) {
        // Si une image est trouvée, on l’enregistre
        article.image = imageUrl;
        await article.save();
        console.log(`✅ Image mise à jour pour: ${article.title}`);
      } else {
        // Si aucune image n'est trouvée, on met la colonne à vide
        article.image = "";
        await article.save();
        console.warn(`⚠️ Aucune image trouvée pour: ${article.title}, champ mis à ""`);
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour des images:", error.message);
  }
}

// comment updateExistingArticlesImages(); // Appel direct


// Route API pour récupérer la dernière mise à jour de la base de données
app.get("/api/last-update", async (req, res) => {
  try {
    // Utilise la méthode max sur le champ updatedAt pour obtenir la date la plus récente
    const lastUpdate = await Article.max('updatedAt');
    res.json({ lastUpdate });
  } catch (error) {
    console.error("Erreur lors de la récupération de la dernière mise à jour :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Lancer le serveur Express
app.listen(PORT, () => {
    console.log(` Serveur en écoute sur http://localhost:${PORT}`);
});





