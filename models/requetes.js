async function addEpub(connection, folder , path) {
    const result = await connection.query(
      "INSERT INTO epub_data (cover,creator,creatorFileAs,date,description,language,path,publisher,subject,title) values (?,?,?,?,?,?,?,?,?,?)",
      [folder.cover,folder.creator,folder.creatorFileAs,new Date(folder.date),folder.description,folder.language, path,folder.publisher,folder.subject,folder.title]
    );
    //console.log(JSON.parse(JSON.stringify(result)))
    return JSON.parse(JSON.stringify(result[0]));
  }

  module.exports = {
    addEpub
  }