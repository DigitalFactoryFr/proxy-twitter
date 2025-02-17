app.get("/twitter/:username", async (req, res) => {
  const username = req.params.username;
  const url = `https://api.twitter.com/2/users/by/username/${username}`;

  try {
    console.log(`🔄 Requête API Twitter pour : ${username}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.BEARER_TOKEN}`,
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
