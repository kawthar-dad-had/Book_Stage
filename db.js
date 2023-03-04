const Sequelize = require('sequelize');

// initialize the database connection
const sequelize = new Sequelize('epub_dream', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql'
  });
  
  // define the model for the table
  const EpubDB = sequelize.define('Testkaw', {
    titleEpub: {
      type: Sequelize.STRING,
      allowNull: true
    },
    creatorEpub: {
      type: Sequelize.STRING,
      allowNull: true
    },
    publisherEpub: {
      type: Sequelize.STRING,
      allowNull: true
    },
    subjectEpub: {
      type: Sequelize.TEXT("long"),
      allowNull: true
    },
    titlePropre: {
      type: Sequelize.STRING,
      allowNull: true
    },
    titleCatalogue: {
      type: Sequelize.STRING,
      allowNull: true
    },
    authorFirsNameCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    authorLastNameCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    traducteurCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    langueCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    typeCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    subjectOpenLibrary: {
      type: Sequelize.TEXT("long"),
      allowNull: true
    },
    birthDateCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    deathDateCatalog: {
      type: Sequelize.STRING,
      allowNull: true
    },
    first_publish_yearOpenLibrary: {
      type: Sequelize.STRING,
      allowNull: true
    },
    genderDataBnf: {
      type: Sequelize.STRING,
      allowNull: true
    },
    age: {
      type: Sequelize.STRING,
      allowNull: true
    },
    descriptionEpub: {
      type: Sequelize.TEXT("long"),
      allowNull: true
    },
    path: {
      type: Sequelize.STRING,
      allowNull: true
    }
  });
  
  // create the table in the database
  sequelize.sync().then(() => {
    console.log('Table created successfully');
  });

  module.exports = EpubDB