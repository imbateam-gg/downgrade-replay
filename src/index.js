const ReplayParser = require("jssuh");
const {
  parseReplay,
  convertReplayTo116,
  AlreadyClassicError,
} = require("./rep");
const { BufferList, BufferListStream } = require("bl");

const {
  DICTIONARY_SIZE3,
  implode,
  BINARY_COMPRESSION,
} = require("../libs/node-pkware/src");
const { Transform, Writable, Readable } = require("stream");
const fs = require("fs");
const REPLAY_MAGIC = 0x53526572;

const compress = new Transform({
  transform: implode(BINARY_COMPRESSION, DICTIONARY_SIZE3),
});
// const write = fs.createWriteStream("./test/116.rep");
// const parse = new ReplayParser();
// const reppi = fs.createReadStream("./test/LastReplay.rep").pipe(parse);

fs.readFile("./test/LastReplay.rep", async (err, buf) => {
  let rep;
  try {
    rep = await parseReplay(buf);
    // rep = convertReplayTo116(rep);
    console.log(rep);
  } catch (e) {
    if (e instanceof AlreadyClassicError) {
      return rep;
    }
    throw e;
  }
});

// reppi.on("error", console.error);
// reppi.on("replayHeader", console.log);
// reppi.on("data", console.log);
// reppi.on("error", (e) => console.error);
// reppi.on("end", () => {
//   console.log("end");
// });

// reppi.pipeChk();
// dump(Buffer.from([REPLAY_MAGIC])).pipe(write);
