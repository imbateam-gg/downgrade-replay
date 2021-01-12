const { Duplex } = require("stream");
const fs = require("fs");
const iconv = require("iconv-lite");
const createScmExtractor = require("scm-extractor");
const concat = require("concat-stream");
const Chk = require("../bw-chk");
const downgradeChk = require("./chk-downgrader.js");

const extractChk = (filename) =>
  new Promise((res, rej) =>
    fs
      .createReadStream(filename)
      .pipe(createScmExtractor())
      .pipe(
        concat((data) => {
          res(data);
        })
      )
  );

extractChk("./test/poly.scx").then((chk) => {
  const origChk = new Chk(chk);
  console.log(origChk);

  const downgraded = downgradeChk(chk);
  fs.writeFile("./test/out.chk", downgraded, (err) => {});

  fs.readFile("./test/out.chk", (err, data) => {
    const newChk = new Chk(data);
    console.log(newChk);
  });
});
