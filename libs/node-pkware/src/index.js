const { implode } = require("./implode");
const { explode } = require("./explode");

const {
  BINARY_COMPRESSION,
  ASCII_COMPRESSION,
  DICTIONARY_SIZE1,
  DICTIONARY_SIZE2,
  DICTIONARY_SIZE3,
} = require("./constants.js");

// aliases
const compress = implode;
const decompress = explode;

module.exports = {
  implode,
  explode,
  compress,
  decompress,
  BINARY_COMPRESSION,
  ASCII_COMPRESSION,
  DICTIONARY_SIZE1,
  DICTIONARY_SIZE2,
  DICTIONARY_SIZE3,
};
