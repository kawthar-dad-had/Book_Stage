const express = require("express");

const app = express();
const EpubDB = require('./db')
const {converter} = require("./converter")
const zipFiles = require("./zipFunction")

app.use(express.json());

app.get("/", async (req, res) => {
    try {
      const size = Number(req.query.size) || null
      const page = Number(req.query.page) || null
      const orders = JSON.parse(req.query.sorts) || []
      const filters1 = JSON.parse(req.query.filters) || []
      const filters = converter(filters1)
  
      const result = await EpubDB.findAndCountAll({
          //limit = size
          //offset = page * size ---->from page 0
          limit: size,
          offset: page*size,
          order: orders,
          where: filters
      });
      const Paths = result.rows.map((row) => row.dataValues.path)
      //const Paths = ["./textFolder/Arnaud Georges-Jean La Compagnie de la banquise.txt"]
      console.log(Paths)
      let output = "zips/2000_2023.zip"
      zipFiles(Paths , output)

      res.status(200).send({result , output});

    } catch (error) {
      console.log(error);
      res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
});

app.listen(3001, (err) => {
  if (err) throw err;
  console.log("> Ready on http://localhost:3001");
});