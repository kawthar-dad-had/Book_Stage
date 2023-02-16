const createPool = require("mysql2/promise").createPool;
const requetes = require("./requetes")

const pool = createPool({
    connectionLimit: 10,
    host: "127.0.0.1",
    port: 3300,
    user: "root",
    password: '',
    database: "dream_epub",
  });

  function functionWrapper(func) {
    return async (...args) => {
      console.log("MySQL connection requested");
      let connection = await pool.getConnection();
      try {
        console.log("Connection obtained");
        const result = await func(connection, ...args);
        console.log("MySQL request executed");
        connection.release();
        console.log("Connection released");
        return result;
      } catch (e) {
        if (connection !== null) connection.release();
        console.log("Connection released");
        console.log(e.message);
        return undefined;
      }
    };
  }
  
  const allImports = {
    ...requetes
  };


  module.exports = Object.keys(allImports).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: functionWrapper(allImports[cur]),
    }),
    {}
  );