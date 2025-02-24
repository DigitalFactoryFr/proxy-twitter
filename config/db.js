require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize'); // 🔥 Ajout de DataTypes

console.log("🔍 Chargement des variables d'environnement :");
console.log(process.env);

console.log("🔍 Vérification des variables pour Sequelize :", {
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT
});

// Création de la connexion à PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME,   // Base de données
  process.env.DB_USER,   // Utilisateur
  process.env.DB_PASS,   // Mot de passe
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log // 🔥 Voir toutes les requêtes SQL exécutées
  }
);

// 🔥 Définition du modèle Article
const Article = sequelize.define("Article", {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  image: {
    type: DataTypes.STRING
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 🆕 Ajout du champ "companies" (tableau de strings, avec valeur par défaut)
  companies: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: []
  }
});


// 📌 Synchronisation de la base de données
sequelize.sync();

module.exports = { sequelize, Article };
