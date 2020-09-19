const jssuh = require("jssuh");
const {
  DICTIONARY_SIZE3,
  compress,
  BINARY_COMPRESSION,
} = require("../libs/node-pkware/src");
const { Transform } = require("stream");

const handler = compress(BINARY_COMPRESSION, DICTIONARY_SIZE3);

// new Transform({
//   transform: handler,
// });
