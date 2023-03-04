const express = require("express");
const util = require('util');
const fs = require('fs');
const zlib = require('zlib');
const StreamZip = require("node-stream-zip")
const path = require("path")
const app = express();
const EpubDB = require('./db')
const {converter} = require("./converter")
const zipFiles = require("./zipFunction")
const cors = require("cors")
const {Op} = require("sequelize")
const multer = require("multer");
const { async } = require("node-stream-zip");

const EPub = require("epub2").EPub;
const axios = require("axios");
const {extractTo} = require("./EPUBToText");
const SPARQL = require("sparql-client-2");
const imagewebroot = "./images"
const chapterwebroot = "./links" 
const textFolder = "./textFolder2" 
const convertXml = require('xml-js');
const { convert } = require('html-to-text');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      fs.mkdir("uploads/", () => {
          cb(null, "uploads/");
      });
  },
  filename: function (req, file, cb) {
      cb(null,file.originalname
      );
  },
});
const fileFilter = function (req, file, cb) {
  var ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".zip") {
      return cb(new Error("Only zips are allowed"));
  }
  cb(null, true);
};



const upload = multer({ storage: storage,fileFilter});


function levenshtein(str1, str2) {
  let dp = [];

  for (let i = 0; i <= str1.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1]);
      }
    }
  } 

  return dp[str1.length][str2.length];
}

function matchPercentage(str1, str2) {
  let maxLength = Math.max(str1.length, str2.length);
  let levenshteinDistance = levenshtein(str1, str2);

  return ((maxLength - levenshteinDistance) / maxLength * 100).toFixed(2);
}

const epubFunction = async () => {

  try {
    const directoryPath = path.join(__dirname, 'unzipFolder/epubs/');
    fs.readdir(directoryPath,async (err, files) => {
      try {
              //handling error
      if (err) {
        return console.log('Unable to scan directory: ' + err);
     }

     
    for (var i = 0; i < files.length; i++) {
      try {
        console.log(i)
        console.log(files[i])
        let dataepub = await EPub.createAsync("unzipFolder/epubs/"+files[i], imagewebroot, chapterwebroot,  {
        unzip: {
          windowBits: 15 // increase windowBits to 15
        }
      })

      if (dataepub.metadata.title && dataepub.metadata.creator) {
        const titlePropre = dataepub.metadata.title.replace(/-|_/g, ' ').replace(/\[[^\]]*\]|\([^\)]*\)/g, "").replace(/\b\w*\d+\w*\b/g, "").replace(/[^a-zA-Z\sàâäéèêëïîôöùûüÿç'`]+/g, "");
        const infos = await getInfo(titlePropre, dataepub.metadata.creator, "");
        const options = {
          wordwrap: 130,
          // ...
        };
        const text = convert(dataepub.metadata.description, options);
        let age = '';
        if ((Number(infos.first_publish_yearOpenLibrary) <= Number(infos.deathDateCatalog) || infos.deathDateCatalog == "....") && infos.first_publish_yearOpenLibrary != '' && infos.birthDateCatalog != '') {
          age = (Number(infos.first_publish_yearOpenLibrary) - Number(infos.birthDateCatalog)).toString();
        } else if (Number(infos.first_publish_yearOpenLibrary) > Number(infos.deathDateCatalog)) {
          age = "Posthume";
        } else if (infos.first_publish_yearOpenLibrary == '' || infos.birthDateCatalog == '' || infos.deathDateCatalog == null) {
          age = "incomplet";
        }
        const md = {
          titleEpub: dataepub.metadata.title,
          creatorEpub: dataepub.metadata.creator,
          publisherEpub: dataepub.metadata.publisher,
          subjectEpub: `${dataepub.metadata.subject}`,
          descriptionEpub: text,
          titlePropre
        };
        let path = '';
        const mdata = { ...md, ...infos, age, path };
        //Transformer epub to txt
        var textFolderName = await extractTo("unzipFolder/epubs/" + files[i], textFolder, mdata, (err) => {
          console.log(err);
        });
        if (textFolderName) {
          mdata.path = textFolderName;
          //inserer dans la bdd
          await EpubDB.create(mdata).then((res) => {
            fs.unlinkSync("unzipFolder/epubs/" + files[i]);
          }).catch((err) => {
            console.log(err);
          });
        }


      }
      /*
      let dataepub = new EPub("00 - TOUT EPUB/"+files[i], imagewebroot, chapterwebroot,  {
        unzip: {
          windowBits: 15 // increase windowBits to 15
        }
      })
      dataepub.on('end', async () => {
          // validation was successful
          console.log('EPUB validation successful');
          if (dataepub.metadata.title && dataepub.metadata.creator) {
            const titlePropre = dataepub.metadata.title.replace(/-|_/g, ' ').replace(/\[[^\]]*\]|\([^\)]*\)/g, "").replace(/\b\w*\d+\w*\b/g, "").replace(/[^a-zA-Z\sàâäéèêëïîôöùûüÿç'`]+/g, "");
            const infos = await getInfo(titlePropre, dataepub.metadata.creator, "");
            const options = {
              wordwrap: 130,
              // ...
            };
            const text = convert(dataepub.metadata.description, options);
            let age = '';
            if ((Number(infos.first_publish_yearOpenLibrary) < Number(infos.deathDateCatalog) || infos.deathDateCatalog == "....") && infos.first_publish_yearOpenLibrary != '' && infos.birthDateCatalog != '') {
              age = (Number(infos.first_publish_yearOpenLibrary) - Number(infos.birthDateCatalog)).toString();
            } else if (Number(infos.first_publish_yearOpenLibrary) > Number(infos.deathDateCatalog)) {
              age = "Posthume";
            } else if (infos.first_publish_yearOpenLibrary == '' || infos.birthDateCatalog == '' || infos.deathDateCatalog == null) {
              age = "incomplet";
            }
            const md = {
              titleEpub: dataepub.metadata.title,
              creatorEpub: dataepub.metadata.creator,
              publisherEpub: dataepub.metadata.publisher,
              subjectEpub: `${dataepub.metadata.subject}`,
              descriptionEpub: text,
              titlePropre
            };
            let path = '';
            const mdata = { ...md, ...infos, age, path };
            //Transformer epub to txt
            var textFolderName = extractTo("00 - TOUT EPUB/" + files[i], textFolder, mdata, (err) => {
              console.log(err);
            });
            if (textFolderName) {
              mdata.path = textFolderName;
              //inserer dans la bdd
              await EpubDB.create(mdata).then((res) => {
                //console.log(res);
              }).catch((err) => {
                console.log(err);
              });
            }


          }
        });

      dataepub.parse()
*/
                    

      

      } catch (error) {
        console.log(error)
      }
      
    }

    /*let headingColumnNames = []
    for (var i = 0; i < data.length; i++) {
      headingColumnNames = headingColumnNames.concat(Object.keys(data[i]))
      headingColumnNames = headingColumnNames.filter((item, pos) => headingColumnNames.indexOf(item) === pos);      
    }
    //console.log(headingColumnNames);
    let headingColumnIndex = 1;
    for (var i = 0; i < headingColumnNames.length; i++){  
      ws.cell(1, headingColumnIndex++).string(headingColumnNames[i])
    };
    let rowIndex = 2;
    data.forEach( record => {
      //let columnIndex = 1;
      Object.keys(record).forEach(columnName =>{
        let columnIndex = headingColumnNames.indexOf(columnName)
        columnIndex++
        ws.cell(rowIndex,columnIndex++)
          .string(record[columnName])
        });
      rowIndex++;
    });
    wb.write('filename1.xlsx');*/
      } catch (error) {
        console.log("fs")
      }
    })
  } catch (error) {
    console.log("kawthar t'as un probleme")
  }

}
const getInfoCatalogue = async (title, author) => {
  try {
    return await axios.get(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=(bib.author%20adj%20%22${author}%22)%20and%20(bib.title%20adj%20%22${title}%22)`)
  } catch (error) {
    console.log("getInfoCatalogue")
  }
}

const getInfoCatalogueAny = async (title, author) => {
  try {
    return await axios.get(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=(bib.author%20adj%20%22${author}%22)%20and%20(bib.title%20any%20%22${title}%22)`)
  } catch (error) {
    console.log("getInfoCatalogueAny")
  }
}
const getInfoCatalogueAnyCreator = async (title, author) => {
  try {
    return await axios.get(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=(bib.author%20any%20%22${author}%22)%20and%20(bib.title%20any%20%22${title}%22)`)
  } catch (error) {
    console.log("getInfoCatalogueAnyCreator")
  }
}

const getInfoOpenLibrary = async (title, author) => {
  try {
    let foundSubject = false
    let foundFirstPublishYear = false
    let subject = ""
    let firstPub = ""
    if(title != '') {
      const result = await axios.get(`https://openlibrary.org/search.json?title=${title}&author=${author}`)
      if(result.data.numFound) {
        let i = 0
        while((!foundFirstPublishYear || !foundSubject) && i < result.data.docs.length) {
          if(result.data.docs[i].subject) {
            subject = result.data.docs[i].subject
            foundSubject = true
          }
          if(result.data.docs[i].first_publish_year){
            firstPub = result.data.docs[i].first_publish_year
            foundFirstPublishYear = true
          }
          i++
        }
        return {first_publish_yearOpenLibrary: `${firstPub}`, subjectOpenLibrary: `${subject}`}
      }
    }
    return {first_publish_yearOpenLibrary: `${firstPub}`, subjectOpenLibrary: `${subject}`}
  
  } catch (error) {
    console.log("getInfoOpenLibrary")
  }

}
async function getFirstPublishYear(title, author) {
  try {
    const client = new SPARQL('https://dbpedia.org/sparql')
    const query = `
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX dbp: <http://dbpedia.org/property/>
  
    SELECT ?title ?name ?date WHERE {
      ?book a dbo:Book .
      ?book dbp:releaseDate ?date .
      ?book dbo:author ?author .
      
      ?book rdfs:label ?title.
      ?author rdfs:label ?name.
      
      FILTER regex(str(?name) , "${author}", "i") .  
      FILTER regex(str(?title) , "${title}", "i") . 
    } LIMIT 1
    `
    const result = await client.query(query, { accept: 'application/sparql-results+json' });
    const results = result.results.bindings;
    if (results.length > 0) {
      return `${results[0].date.value}`;
    }
    return "";
  } catch (error) {
    console.log("getFirstPublishYear")
  }
}

const verification = async (title, author, nomFichier) => {
  try {
    const bk = await getInfoCatalogue(title, author)
    let titleCatalogue = ''
    let typeAny = false
    let records = []
    let percentages = []
    let authorLastNameCatalog = ''
    let authorFirsNameCatalog = ''
    let found = false
    let obj = {}

    if (bk.data) {
      let xmlData = convertXml.xml2json(bk.data, {
        compact: true,
        space: 4
      })
     //let xmlData = await parseXml(bk.data)
      obj = JSON.parse(xmlData)
    }

  
    console.log("adj")

    if (obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      try {
        console.log("AnyCreator")
        const bk = await getInfoCatalogueAnyCreator(title, author)
        
        let xmlData = convertXml.xml2json(bk.data, {
          compact: true,
          space: 4
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
        //let xmlData = await parseXml(bk.data)
        let obj1 = JSON.parse(xmlData)
        if(obj1['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
          if(!Array.isArray(obj1['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
            records.push(obj1['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
          }else {
            records = obj1['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
          }
          let i = 0
          while(i < records.length && !found) {
            let k = 0
            while(k < records[i]['mxc:record']['mxc:datafield'].length && !found) {
              if(records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "700"){
                let l = 0
                while(l < records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
                  if(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "a" && author.includes(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'])) {//nom
                    authorLastNameCatalog = records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
                  } else if(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "b" && author.includes(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'])) {//prenom
                    authorFirsNameCatalog = records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
                  }
                  l++
                }
              }
              if (authorLastNameCatalog == '' || authorFirsNameCatalog == '') {
                authorLastNameCatalog = ''
                authorFirsNameCatalog = ''
              }else {
                found = true
              }
              k++
            }
            i++
          }
        } 
      } catch (error) {
        console.log("error verification")
      }
    }

    if(found) {
      try {
        const bk = await getInfoCatalogue(title, authorFirsNameCatalog + ' ' + authorLastNameCatalog)
        
        if (bk.data) {
          let xmlData = convertXml.xml2json(bk.data, {
            compact: true,
            space: 4
          })
          
          //let xmlData = await parseXml(bk.data)
          obj = JSON.parse(xmlData)
        }
      } catch (error) {
        console.log("found error")
      }

    }
    

    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      try {
        const bk = await getInfoCatalogue(nomFichier, author)
        
        if (bk.data) {
          let xmlData = convertXml.xml2json(bk.data, {
            compact: true,
            space: 4
          });
          
          //let xmlData = await parseXml(bk.data)
          obj = JSON.parse(xmlData)
        }
      } catch (error) {
        console.log(error)
      }
    }
  
    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
      if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
        records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
      }else {
        records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
      }
      
    }
  
    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      try {
        let bk
        console.log("Any")
        if (found) {
          bk = await getInfoCatalogueAny(title, authorFirsNameCatalog + ' ' + authorLastNameCatalog)
        }else {
          bk = await getInfoCatalogueAny(title, author)
        }
        
        if(bk.data) {
          let xmlData = convertXml.xml2json(bk.data, {
            compact: true,
            space: 4
          });
          
          //let xmlData = await parseXml(bk.data)
          obj = JSON.parse(xmlData)
        }
        typeAny = true
        if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
          if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
            records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
          }else {
            records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
          }
          let i = 0
          while(i < records.length) {
            let k = 0
            while(k < records[i]['mxc:record']['mxc:datafield'].length) {
              if(records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "200"){
                let l = 0
                while(l < records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
                  if(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "a") {
                    percentages.push({title: records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'], percentage: matchPercentage(records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'].toLowerCase(), title.toLowerCase())})
                  }
                  l++
                }
              }
              k++
            }
            i++
          }
        } 
      } catch (error) {
        console.log("error verification 2")
      }
    }


    
    if(percentages.length > 0) {
      const maxPercentage = percentages.reduce((max, curr) => (Number(curr.percentage) > Number(max.percentage) ? curr : max));
      titleCatalogue = maxPercentage.title
      if(maxPercentage.percentage > 70){
        try {
          console.log(title , titleCatalogue , maxPercentage.percentage)
          const bk = await getInfoCatalogue(titleCatalogue, author)
          typeAny = false
          if (bk.data) {
                      
          let xmlData = convertXml.xml2json(bk.data, {
            compact: true,
            space: 4
          });
          
          //let xmlData = await parseXml(bk.data)
          obj = JSON.parse(xmlData)
          }
          if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
            if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
              records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
            }else {
              records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
            }
            
          }
        } catch (error) {
          console.log("error percentage")
        }
      }
  
    }



    return { records, titleCatalogue, typeAny}
  } catch (error) {
    console.log("verification")
  }
}

async function getGender(fullName) {
  try {
    const sources = [
      //{ url: "https://data.bnf.fr/sparql", prefix: "RDAgroup2elements" },
      { url: "https://data.bnf.fr/sparql", prefix: "foaf" },
      //{ url: "http://dbpedia.org/sparql", prefix: "rdf" },
      //{ url: "http://dbpedia.org/sparql", prefix: "owl" },
      //{ url: "https://query.wikidata.org/sparql", prefix: "wikidata" }
    ];
    for (const source of sources) {
      const client = new SPARQL(source.url);
      const query = `
        PREFIX ${source.prefix}: <http://xmlns.com/${source.prefix}/0.1/>
        PREFIX bio: <http://vocab.org/bio/0.1/>
        SELECT  ?gender   
        WHERE {
            ?auteur ${source.prefix}:gender ?gender.
            ?auteur ${source.prefix}:name  '${fullName}'.
        }
        LIMIT 100
      `;
      const result = await client.query(query, { accept: 'application/sparql-results+json' });
      const results = result.results.bindings;
      if (results.length) {
        return results[0].gender.value;
      }
    }
    return "";
  } catch (error) {
    console.log("getGender")
  }
}

const getInfo = async (title, author, nomFichier) => {
  try {
    
  let foundLangue = false
  let foundTraducteur = false
  let foundFirstName = false
  let foundLastName = false
  let foundDates = false
  let foundType = false
  let foundTitle = false
  let langueCatalog = ""
  let traducteurCatalog = ""
  let authorFirsNameCatalog = ""
  let authorLastNameCatalog = ""
  let authorDatesCatalog = ""
  let typeCatalog = ""

  const obj = await verification(title, author, nomFichier)
  
  if(obj.records.length > 0) {
    if(obj.typeAny) {
      foundLangue = true
      foundTraducteur = true
      foundType = true
    }

    let i = 0
    while((!foundLangue || !foundFirstName || !foundLastName || !foundDates || !foundTraducteur || !foundType || !foundTitle) && i < obj.records.length) {
      let k = 0
      while(k < obj.records[i]['mxc:record']['mxc:datafield'].length) {
        if((!foundTraducteur || !foundType || !foundTitle) && obj.records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "200" && !obj.typeAny){
          let l = 0
          while((!foundTraducteur || !foundType || !foundTitle) && l < obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
            if(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "a" && !foundTitle) {//title
              console.log(matchPercentage(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'],title),title,obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'])
              if(matchPercentage(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'].toLowerCase(),title.toLowerCase()) > 70){
                obj.titleCatalogue = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
                foundTitle = true
              }
            } else if(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "g" && !foundTraducteur) {//traducteur
              traducteurCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
              foundTraducteur = true
            } else if(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "e" && !foundType) {//type
              typeCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
              foundType = true
            }
            l++
          }
        } else if(!foundLangue && obj.records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "101" && !obj.typeAny){// a et c
          if(Array.isArray(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'])) {
            let l = 0
            while(!foundLangue && l < obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
              if(!foundLangue && obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "c"){
                langueCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
                foundLangue = true    
              }
              l++
            }
          } else if(typeof(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield']) == 'object') {
            langueCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield']['_text']
          }
        } else if((!foundFirstName || !foundLastName || !foundDates) && obj.records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "700"){
          let l = 0
          while((!foundFirstName || !foundLastName || !foundDates) && l < obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
            if(!foundLastName && obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "a") {//nom
              authorLastNameCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
              foundLastName = true
            } else if(!foundFirstName && obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "b") {//prenom
              authorFirsNameCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
              foundFirstName = true
            } else if(!foundDates && obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "f") {//dates (birth, death)
              authorDatesCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
              foundDates = true
            }
            l++
          }
        }
        k++
      }
      i++
    }
  }
  let openLibrary = await getInfoOpenLibrary(obj.titleCatalogue, author)
  if(openLibrary.first_publish_yearOpenLibrary == ''){
    if (obj.titleCatalogue != '') {
      openLibrary.first_publish_yearOpenLibrary = await getFirstPublishYear(obj.titleCatalogue, authorFirsNameCatalog+" "+authorLastNameCatalog)
    }else {
      openLibrary.first_publish_yearOpenLibrary = await getFirstPublishYear(title, authorFirsNameCatalog+" "+authorLastNameCatalog)

    }
  }
  if (openLibrary.first_publish_yearOpenLibrary != '') {
    openLibrary.first_publish_yearOpenLibrary = new Date(openLibrary.first_publish_yearOpenLibrary).getFullYear()
  }
  
  const genderDataBnf = await getGender(authorFirsNameCatalog+" "+authorLastNameCatalog)
  if (!author.includes(authorFirsNameCatalog) && !author.includes(authorLastNameCatalog)) {
    return {}

  }else {
    return {traducteurCatalog, authorFirsNameCatalog, authorLastNameCatalog, birthDateCatalog: authorDatesCatalog.split("-")[0], deathDateCatalog: authorDatesCatalog.split("-")[1], typeCatalog, langueCatalog, titleCatalogue: obj.titleCatalogue, first_publish_yearOpenLibrary: openLibrary.first_publish_yearOpenLibrary, subjectOpenLibrary: openLibrary.subjectOpenLibrary, genderDataBnf}

  }
  } catch (error) {
    console.log("getInfo")
  }
}


app.use(express.json());
app.use(cors())
app.use("/zips", express.static("zips"));
app.get("/books", async (req, res) => {
    try {
      console.log(req.query);
      const start = Number(req.query._size) || null
      const end = Number(req.query._end) || null
      const titleEpub_like = req.query.titleEpub_like || ''
      const authorFirsNameCatalog_like = req.query.authorFirsNameCatalog_like || ''
      const authorLastNameCatalog_like = req.query.authorLastNameCatalog_like || ''
      const publisherEpub_like = req.query.publisherEpub_like || ''
      const descriptionEpub_like = req.query.descriptionEpub_like || ''
      const traducteurCatalog = req.query.traducteurCatalog || ''
      const langueCatalog = req.query.langueCatalog || ''
      const genderDataBnf = req.query.genderDataBnf || ''
      const birthDateCatalog_lt = req.query.birthDateCatalog_lt || ''
      const birthDateCatalog_gt = req.query.birthDateCatalog_gt || ''
      const birthDateCatalog_lte =req.query.birthDateCatalog_lte || ''
      const birthDateCatalog_gte =req.query.birthDateCatalog_gte || ''
      const birthDateCatalog_between = req.query.birthDateCatalog_between || ''
      const deathDateCatalog_lt = req.query.deathDateCatalog_lt || ''
      const deathDateCatalog_gt = req.query.deathDateCatalog_gt || ''
      const deathDateCatalog_lte =req.query.deathDateCatalog_lte || ''
      const deathDateCatalog_gte =req.query.deathDateCatalog_gte || ''
      const deathDateCatalog_between = req.query.deathDateCatalog_between || ''
      const first_publish_yearOpenLibrary_lt = req.query.first_publish_yearOpenLibrary_lt || ''
      const first_publish_yearOpenLibrary_gt = req.query.first_publish_yearOpenLibrary_gt || ''
      const first_publish_yearOpenLibrary_lte =req.query.first_publish_yearOpenLibrary_lte || ''
      const first_publish_yearOpenLibrary_gte =req.query.first_publish_yearOpenLibrary_gte || ''
      const first_publish_yearOpenLibrary_between = req.query.first_publish_yearOpenLibrary_between || ''
      const age_lt = req.query.age_lt || ''
      const age_gt = req.query.age_gt || ''
      const age_lte =req.query.age_lte || ''
      const age_gte =req.query.age_gte || ''
      const age_between = req.query.age_between || ''
      


      const order = req.query._order || ''
      const sort = req.query._sort || ''
      
      let orders = []
      
      if(sort != '' && order != '') orders.push([sort, order])
      
      let filters = {}
      
      if(titleEpub_like != '') filters['titleEpub'] = { [Op.substring]: titleEpub_like }
      if(authorFirsNameCatalog_like != '') filters['authorFirsNameCatalog'] = { [Op.substring]: authorFirsNameCatalog_like }
      if(authorLastNameCatalog_like != '') filters['authorLastNameCatalog'] = { [Op.substring]: authorLastNameCatalog_like }
      if(publisherEpub_like != '') filters['publisherEpub'] = { [Op.substring]: publisherEpub_like }
      if(descriptionEpub_like != '') filters['descriptionEpub'] = { [Op.substring]: descriptionEpub_like }
      if(traducteurCatalog == 'null') filters['traducteurCatalog'] = { [Op.eq]: '' }
      else if(traducteurCatalog == 'not null') filters['traducteurCatalog'] = { [Op.ne]: '' }
      if(langueCatalog != '') filters['langueCatalog'] = { [Op.eq]: langueCatalog }
      if(genderDataBnf != '') filters['genderDataBnf'] = { [Op.eq]: genderDataBnf }
      if(birthDateCatalog_lt != '') filters['birthDateCatalog'] = { [Op.lt]: birthDateCatalog_lt, [Op.ne]: ''}
      else if(birthDateCatalog_gt != '') filters['birthDateCatalog'] = { [Op.gt]: birthDateCatalog_gt , [Op.ne]: ''}
      else if(birthDateCatalog_lte != '') filters['birthDateCatalog'] = { [Op.lte]: birthDateCatalog_lte, [Op.ne]: '' }
      else if(birthDateCatalog_gte != '') filters['birthDateCatalog'] = { [Op.gte]: birthDateCatalog_gte , [Op.ne]: ''}
      else if(birthDateCatalog_between != '') filters['birthDateCatalog'] = { [Op.between]: birthDateCatalog_between.split('/'), [Op.ne]: '' }
      if(deathDateCatalog_lt != '') filters['deathDateCatalog'] = { [Op.lt]: deathDateCatalog_lt, [Op.ne]: '' , [Op.ne]: '....'}
      else if(deathDateCatalog_gt != '') filters['deathDateCatalog'] = { [Op.gt]: deathDateCatalog_gt , [Op.ne]: '', [Op.ne]: '....'}
      else if(deathDateCatalog_lte != '') filters['deathDateCatalog'] = { [Op.lte]: deathDateCatalog_lte, [Op.ne]: '' , [Op.ne]: '....'}
      else if(deathDateCatalog_gte != '') filters['deathDateCatalog'] = { [Op.gte]: deathDateCatalog_gte , [Op.ne]: '', [Op.ne]: '....'}
      else if(deathDateCatalog_between != '') filters['deathDateCatalog'] = { [Op.between]: deathDateCatalog_between.split('/'), [Op.ne]: '', [Op.ne]: '....' }
      if(first_publish_yearOpenLibrary_lt != '') filters['first_publish_yearOpenLibrary'] = { [Op.lt]: first_publish_yearOpenLibrary_lt, [Op.ne]: ''}
      else if(first_publish_yearOpenLibrary_gt != '') filters['first_publish_yearOpenLibrary'] = { [Op.gt]: first_publish_yearOpenLibrary_gt , [Op.ne]: ''}
      else if(first_publish_yearOpenLibrary_lte != '') filters['first_publish_yearOpenLibrary'] = { [Op.lte]: first_publish_yearOpenLibrary_lte, [Op.ne]: '' }
      else if(first_publish_yearOpenLibrary_gte != '') filters['first_publish_yearOpenLibrary'] = { [Op.gte]: first_publish_yearOpenLibrary_gte , [Op.ne]: ''}
      else if(first_publish_yearOpenLibrary_between != '') filters['first_publish_yearOpenLibrary'] = { [Op.between]: first_publish_yearOpenLibrary_between.split('/'), [Op.ne]: '' }
      if(age_lt != '') filters['age'] = { [Op.lt]: age_lt, [Op.ne]: '' , [Op.ne]: 'Posthume', [Op.ne]: 'incomplet' , [Op.not]: null}
      else if(age_gt != '') filters['age'] = { [Op.gt]: age_gt , [Op.ne]: '', [Op.ne]: 'Posthume', [Op.ne]: 'incomplet', [Op.not]: null}
      else if(age_lte != '') filters['age'] = { [Op.lte]: age_lte, [Op.ne]: '', [Op.ne]: 'Posthume', [Op.ne]: 'incomplet', [Op.not]: null }
      else if(age_gte != '') filters['age'] = { [Op.gte]: age_gte , [Op.ne]: '', [Op.ne]: 'Posthume', [Op.ne]: 'incomplet', [Op.not]: null}
      else if(age_between != '') filters['age'] = { [Op.between]: age_between.split('/'), [Op.ne]: '', [Op.ne]: 'Posthume', [Op.ne]: 'incomplet' , [Op.not]: null}
      

      //console.log(filters)
      
      const result = await EpubDB.findAndCountAll({
          //limit = size
          //offset = page * size ---->from page 0
          limit: parseInt(end - start),
          offset: parseInt(((end/(end-start))-1 )*(end-start)),
          order: orders,
          where: filters
      });
      const Paths = result.rows.map((row) => row.dataValues.path)
      //const Paths = ["./textFolder/Arnaud Georges-Jean La Compagnie de la banquise.txt"]
      let output = "zips/Results.zip"
      zipFiles(Paths , output)
      res.header("x-total-count", result.count);
      res.header("Access-Control-Expose-Headers", "x-total-count");
      res.status(200).send({result: result.rows , output});

    } catch (error) {
      console.log(error);
      res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
});

app.post("/", upload.single("file") , async (req,res) => {
  try {
    console.log(req.file)
    const zipFilePath = "./uploads/"+req.file.filename;
    console.log(zipFilePath)
    const targetDir = './unzipFolder';
    
    const zip = new StreamZip({
      file: zipFilePath,
      storeEntries: true
    });
    const extractAsync = util.promisify(zip.extract).bind(zip);
    // Wait for the zip file to be opened
    zip.on('ready',async () => {
      try{
      // Loop through all the entries in the zip file
      for (const entryName in zip.entries()) {
        // Extract the entry to the target directory
        const entry = zip.entry(entryName);
        const entryPath = path.join(targetDir, entryName);
        if (entry.isDirectory) {
          // If the entry is a directory, create the directory in the target directory
          fs.mkdirSync(entryPath, { recursive: true });
        }else {
          // If the entry is a file, extract the file to the target directory
          await extractAsync(entryName, entryPath);
          console.log(`Extracted ${entryName} to ${entryPath}`);
        }
      }
      console.log('Extraction completed successfully.');
      
    } catch (err) {
      console.error(`Failed to extract zip file: ${err}`);
    } finally {
      // Close the zip file
      zip.close();
    }
  });
  await epubFunction()
  } catch (error) {
    console.log("kawthar")
  }

})


app.listen(3001, (err) => {
  if (err) throw err;
  console.log("> Ready on http://localhost:3001");
});