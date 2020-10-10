const { parseReplay, convertReplayTo116 } = require("./rep");

const fs = require("fs");

fs.readFile("./test/LastReplay.rep", async (err, buf) => {
  try {
    const classicRep = await convertReplayTo116(buf);
    fs.writeFile("./test/out.116.rep", classicRep, (err) => console.error(err));
    const reloadedRep = await parseReplay(classicRep);

    console.log(reloadedRep);
  } catch (e) {
    throw e;
  }
});
