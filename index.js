const EPub = require("epub2").EPub;
const axios = require("axios");
const {extractTo} = require("./EPUBToText");
const models = require("./models");
const SPARQL = require("sparql-client-2");
const EpubDB = require('./db')
const epubfile = "./epubs/(1933) Hommage à Zola - Louis-Ferdinand Céline.epub"
const imagewebroot = "./images"
const chapterwebroot = "./links" 
const textFolder = "./textFolder" 
const convertXml = require('xml-js');
const { convert } = require('html-to-text');
const {addEpub} = models
const path = require('path');
const fs = require('fs');
const xl = require('excel4node');
const wb = new xl.Workbook();
const ws = wb.addWorksheet('Worksheet Name'); 

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



//Extraire
const epubFunction = () => {

  try {
    const directoryPath = path.join(__dirname, 'epub7');
    fs.readdir(directoryPath,async (err, files) => {
      try {
              //handling error
      if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    for (var i = 0; i < files.length; i++) {
      try {
        let dataepub = await EPub.createAsync("epub7/"+files[i], imagewebroot, chapterwebroot);
        if(dataepub.metadata.title && dataepub.metadata.creator ){
          const titlePropre = dataepub.metadata.title.replace(/-|_/g, ' ').replace(/\[[^\]]*\]|\([^\)]*\)/g, "").replace(/\b\w*\d+\w*\b/g, "").replace(/[^a-zA-Z\sàâäéèêëïîôöùûüÿç'`]+/g, "")
          console.log(i)
          const infos = await getInfo(titlePropre, dataepub.metadata.creator, "")
          const options = {
            wordwrap: 130,
            // ...
          };
          const text = convert(dataepub.metadata.description, options)
          let age = ''
          if((Number(infos.first_publish_yearOpenLibrary) < Number(infos.deathDateCatalog) || infos.deathDateCatalog == "...." ) && infos.first_publish_yearOpenLibrary != '' && infos.birthDateCatalog != ''){
            age = (Number(infos.first_publish_yearOpenLibrary) - Number(infos.birthDateCatalog)).toString()
          }else if (Number(infos.first_publish_yearOpenLibrary) > Number(infos.deathDateCatalog)) {
            age = "Posthume"
          }else if(infos.first_publish_yearOpenLibrary == '' || infos.birthDateCatalog == '' || infos.deathDateCatalog == null) {
            age = "incomplet"
          }
          const md = {
            titleEpub: dataepub.metadata.title,
            creatorEpub: dataepub.metadata.creator,
            publisherEpub: dataepub.metadata.publisher,
            subjectEpub: `${dataepub.metadata.subject}`,
            descriptionEpub: text,
            titlePropre
          }
          let path = ''
          const mdata = {...md, ...infos, age , path}
          //Transformer epub to txt
          var textFolderName = extractTo("epub7/"+files[i],textFolder , mdata , (err) => {
            console.log(err);
          })
          if (textFolderName) {
            mdata.path = textFolderName
            //inserer dans la bdd
            EpubDB.create(mdata).then((res) => {
              //console.log(res);
            }).catch((err) => {
              console.log(err);
            }) 
          }

          
        }
  
      } catch (error) {
        console.log("for")
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
epubFunction()
/*
const headingColumnNames = [
  "Name",
  "Email",
  "Mobile",
]
let headingColumnIndex = 1;
    headingColumnNames.forEach(heading => {
        ws.cell(1, headingColumnIndex++)
            .string(heading)
    });
    let rowIndex = 2;
    data.forEach( record => {
        let columnIndex = 1;
        Object.keys(record ).forEach(columnName =>{
            ws.cell(rowIndex,columnIndex++)
                .string(record [columnName])
        });
        rowIndex++;
    });
    wb.write('filename.xlsx');
*/




//verification
/*
let titleepub = ''
const lg = 'fr'
const getBreeds = async () => {
    try {
      return await axios.get('https://www.googleapis.com/books/v1/volumes?q=title:'+titleepub+'lg:'+lg)
    } catch (error) {
      console.error(error)
    }
  }
  
  var title = ''
  var subtitle = ''
  var authors = ''
  var printType = ''
  var pageCount = ''
  var publisher = ''
  var publishedDate = ''
  var webReaderLink = ''
  const countBreeds = async () => {
    const bk = await getBreeds()
    const book = bk.data.items[0]
    if (book) {
        //console.log(`Got ${Object.entries(breeds.data.message).length} breeds`)
        title = book['volumeInfo']['title'];
        subtitle = book['volumeInfo']['subtitle'];
        authors = book['volumeInfo']['authors'];
        printType = book['volumeInfo']['printType'];
        pageCount = book['volumeInfo']['pageCount'];
        publisher = book['volumeInfo']['publisher'];
        publishedDate = book['volumeInfo']['publishedDate'];
        webReaderLink = book['accessInfo']['webReaderLink'];
    }
  }
  countBreeds().then(() => {
    console.log({title , subtitle ,authors });
  })
 */

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
    return await axios.get(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=(bib.author%20any%20%22${author}%22)%20and%20(bib.title%20adj%20%22${title}%22)`)
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
  
    let xmlData = convertXml.xml2json(bk.data, {
      compact: true,
      space: 4
    });
    let obj = JSON.parse(xmlData)
  
    console.log("adj")
/*
    if (obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      console.log("AnyCreator")
      const bk = await getInfoCatalogueAnyCreator(title, author)
      let xmlData = convertXml.xml2json(bk.data, {
        compact: true,
        space: 4
      });
      obj = JSON.parse(xmlData)
      if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
        if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
          records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
        }else {
          records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
        }
        let i = 0
        while(i < records.length || !found) {
          let k = 0
          while(k < records[i]['mxc:record']['mxc:datafield'].length && !found) {
            if(records[i]['mxc:record']['mxc:datafield'][k]['_attributes']['tag'] == "700"){
              let l = 0
              while(l < records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'].length) {
                if(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "a" && author.includes(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'])) {//nom
                  authorLastNameCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
                } else if(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_attributes']['code'] == "b" && author.includes(obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text'])) {//prenom
                  authorFirsNameCatalog = obj.records[i]['mxc:record']['mxc:datafield'][k]['mxc:subfield'][l]['_text']
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
    }

    if(found) {
      const bk = await getInfoCatalogue(titleCatalogue, author)
      let xmlData = convertXml.xml2json(bk.data, {
        compact: true,
        space: 4
      });
      obj = JSON.parse(xmlData)
    }
*/
    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      const bk = await getInfoCatalogue(nomFichier, author)
      let xmlData = convertXml.xml2json(bk.data, {
        compact: true,
        space: 4
      });
      obj = JSON.parse(xmlData)
    }
  
    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
      if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
        records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
      }else {
        records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
      }
      
    }
  
    if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] == 0) {
      console.log("Any")
      const bk = await getInfoCatalogueAny(title, author)
      let xmlData = convertXml.xml2json(bk.data, {
        compact: true,
        space: 4
      });
      obj = JSON.parse(xmlData)
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
    }


    
    if(percentages.length > 0) {
      const maxPercentage = percentages.reduce((max, curr) => (Number(curr.percentage) > Number(max.percentage) ? curr : max));
      titleCatalogue = maxPercentage.title
      if(maxPercentage.percentage > 70){
        console.log(title , titleCatalogue , maxPercentage.percentage)
        const bk = await getInfoCatalogue(titleCatalogue, author)
        typeAny = false
        let xmlData = convertXml.xml2json(bk.data, {
          compact: true,
          space: 4
        });
        obj = JSON.parse(xmlData)
        if(obj['srw:searchRetrieveResponse']['srw:numberOfRecords']['_text'] > 0) {
          if(!Array.isArray(obj['srw:searchRetrieveResponse']['srw:records']['srw:record'])){
            records.push(obj['srw:searchRetrieveResponse']['srw:records']['srw:record']['srw:recordData'])
          }else {
            records = obj['srw:searchRetrieveResponse']['srw:records']['srw:record'].map(record => record['srw:recordData']);
          }
          
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
  return {traducteurCatalog, authorFirsNameCatalog, authorLastNameCatalog, birthDateCatalog: authorDatesCatalog.split("-")[0], deathDateCatalog: authorDatesCatalog.split("-")[1], typeCatalog, langueCatalog, titleCatalogue: obj.titleCatalogue, first_publish_yearOpenLibrary: openLibrary.first_publish_yearOpenLibrary, subjectOpenLibrary: openLibrary.subjectOpenLibrary, genderDataBnf}
  } catch (error) {
    console.log("getInfo")
  }
}