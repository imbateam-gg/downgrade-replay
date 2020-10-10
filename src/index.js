// based HEAVILY on jssuh, screp & openbw <3
// uses a local copy of https://github.com/meszaros-lajos-gyorgy/node-pkware
const { BufferList } = require("bl");
const { Writable, Readable, Transform } = require("stream");

const iconv = require("iconv-lite");
const {
  DICTIONARY_SIZE3,
  DICTIONARY_SIZE1,
  implode,
  explode,
  BINARY_COMPRESSION,
} = require("../libs/node-pkware/src");

const zlib = require("zlib");

const HeaderMagicClassic = 0x53526572;
const HeaderMagicScrModern = 0x53526573;
const MAX_CHUNK_SIZE = 0x2000;

// ported from https://github.com/brianloveswords/buffer-crc32/blob/master/index.js
// does not use the final xor
var CRC_TABLE = [
  0x00000000,
  0x77073096,
  0xee0e612c,
  0x990951ba,
  0x076dc419,
  0x706af48f,
  0xe963a535,
  0x9e6495a3,
  0x0edb8832,
  0x79dcb8a4,
  0xe0d5e91e,
  0x97d2d988,
  0x09b64c2b,
  0x7eb17cbd,
  0xe7b82d07,
  0x90bf1d91,
  0x1db71064,
  0x6ab020f2,
  0xf3b97148,
  0x84be41de,
  0x1adad47d,
  0x6ddde4eb,
  0xf4d4b551,
  0x83d385c7,
  0x136c9856,
  0x646ba8c0,
  0xfd62f97a,
  0x8a65c9ec,
  0x14015c4f,
  0x63066cd9,
  0xfa0f3d63,
  0x8d080df5,
  0x3b6e20c8,
  0x4c69105e,
  0xd56041e4,
  0xa2677172,
  0x3c03e4d1,
  0x4b04d447,
  0xd20d85fd,
  0xa50ab56b,
  0x35b5a8fa,
  0x42b2986c,
  0xdbbbc9d6,
  0xacbcf940,
  0x32d86ce3,
  0x45df5c75,
  0xdcd60dcf,
  0xabd13d59,
  0x26d930ac,
  0x51de003a,
  0xc8d75180,
  0xbfd06116,
  0x21b4f4b5,
  0x56b3c423,
  0xcfba9599,
  0xb8bda50f,
  0x2802b89e,
  0x5f058808,
  0xc60cd9b2,
  0xb10be924,
  0x2f6f7c87,
  0x58684c11,
  0xc1611dab,
  0xb6662d3d,
  0x76dc4190,
  0x01db7106,
  0x98d220bc,
  0xefd5102a,
  0x71b18589,
  0x06b6b51f,
  0x9fbfe4a5,
  0xe8b8d433,
  0x7807c9a2,
  0x0f00f934,
  0x9609a88e,
  0xe10e9818,
  0x7f6a0dbb,
  0x086d3d2d,
  0x91646c97,
  0xe6635c01,
  0x6b6b51f4,
  0x1c6c6162,
  0x856530d8,
  0xf262004e,
  0x6c0695ed,
  0x1b01a57b,
  0x8208f4c1,
  0xf50fc457,
  0x65b0d9c6,
  0x12b7e950,
  0x8bbeb8ea,
  0xfcb9887c,
  0x62dd1ddf,
  0x15da2d49,
  0x8cd37cf3,
  0xfbd44c65,
  0x4db26158,
  0x3ab551ce,
  0xa3bc0074,
  0xd4bb30e2,
  0x4adfa541,
  0x3dd895d7,
  0xa4d1c46d,
  0xd3d6f4fb,
  0x4369e96a,
  0x346ed9fc,
  0xad678846,
  0xda60b8d0,
  0x44042d73,
  0x33031de5,
  0xaa0a4c5f,
  0xdd0d7cc9,
  0x5005713c,
  0x270241aa,
  0xbe0b1010,
  0xc90c2086,
  0x5768b525,
  0x206f85b3,
  0xb966d409,
  0xce61e49f,
  0x5edef90e,
  0x29d9c998,
  0xb0d09822,
  0xc7d7a8b4,
  0x59b33d17,
  0x2eb40d81,
  0xb7bd5c3b,
  0xc0ba6cad,
  0xedb88320,
  0x9abfb3b6,
  0x03b6e20c,
  0x74b1d29a,
  0xead54739,
  0x9dd277af,
  0x04db2615,
  0x73dc1683,
  0xe3630b12,
  0x94643b84,
  0x0d6d6a3e,
  0x7a6a5aa8,
  0xe40ecf0b,
  0x9309ff9d,
  0x0a00ae27,
  0x7d079eb1,
  0xf00f9344,
  0x8708a3d2,
  0x1e01f268,
  0x6906c2fe,
  0xf762575d,
  0x806567cb,
  0x196c3671,
  0x6e6b06e7,
  0xfed41b76,
  0x89d32be0,
  0x10da7a5a,
  0x67dd4acc,
  0xf9b9df6f,
  0x8ebeeff9,
  0x17b7be43,
  0x60b08ed5,
  0xd6d6a3e8,
  0xa1d1937e,
  0x38d8c2c4,
  0x4fdff252,
  0xd1bb67f1,
  0xa6bc5767,
  0x3fb506dd,
  0x48b2364b,
  0xd80d2bda,
  0xaf0a1b4c,
  0x36034af6,
  0x41047a60,
  0xdf60efc3,
  0xa867df55,
  0x316e8eef,
  0x4669be79,
  0xcb61b38c,
  0xbc66831a,
  0x256fd2a0,
  0x5268e236,
  0xcc0c7795,
  0xbb0b4703,
  0x220216b9,
  0x5505262f,
  0xc5ba3bbe,
  0xb2bd0b28,
  0x2bb45a92,
  0x5cb36a04,
  0xc2d7ffa7,
  0xb5d0cf31,
  0x2cd99e8b,
  0x5bdeae1d,
  0x9b64c2b0,
  0xec63f226,
  0x756aa39c,
  0x026d930a,
  0x9c0906a9,
  0xeb0e363f,
  0x72076785,
  0x05005713,
  0x95bf4a82,
  0xe2b87a14,
  0x7bb12bae,
  0x0cb61b38,
  0x92d28e9b,
  0xe5d5be0d,
  0x7cdcefb7,
  0x0bdbdf21,
  0x86d3d2d4,
  0xf1d4e242,
  0x68ddb3f8,
  0x1fda836e,
  0x81be16cd,
  0xf6b9265b,
  0x6fb077e1,
  0x18b74777,
  0x88085ae6,
  0xff0f6a70,
  0x66063bca,
  0x11010b5c,
  0x8f659eff,
  0xf862ae69,
  0x616bffd3,
  0x166ccf45,
  0xa00ae278,
  0xd70dd2ee,
  0x4e048354,
  0x3903b3c2,
  0xa7672661,
  0xd06016f7,
  0x4969474d,
  0x3e6e77db,
  0xaed16a4a,
  0xd9d65adc,
  0x40df0b66,
  0x37d83bf0,
  0xa9bcae53,
  0xdebb9ec5,
  0x47b2cf7f,
  0x30b5ffe9,
  0xbdbdf21c,
  0xcabac28a,
  0x53b39330,
  0x24b4a3a6,
  0xbad03605,
  0xcdd70693,
  0x54de5729,
  0x23d967bf,
  0xb3667a2e,
  0xc4614ab8,
  0x5d681b02,
  0x2a6f2b94,
  0xb40bbe37,
  0xc30c8ea1,
  0x5a05df1b,
  0x2d02ef8d,
];

const _crc32 = (buf, crc) => {
  for (var n = 0; n < buf.length; n++) {
    crc = CRC_TABLE[(crc ^ buf[n]) & 0xff] ^ (crc >>> 8);
  }
  return crc;
};

const crc32 = (buf) => {
  return _crc32(buf, 0xffffffff) >>> 0;
};

const CMDS = (() => {
  const c = (id, len) => ({ id, length: () => len });
  const fun = (id, func) => ({ id, length: func });
  const saveLength = (data) => {
    if (data.length < 5) {
      return null;
    }
    const pos = data.indexOf(0, 5);
    return 1 + (pos === -1 ? data.length : pos);
  };
  const selectLength = (data) => {
    if (data.length < 1) {
      return null;
    }
    return 2 + data.readUInt8(0) * 2;
  };
  const extSelectLength = (data) => {
    if (data.length < 1) {
      return null;
    }
    return 2 + data.readUInt8(0) * 4;
  };
  return {
    KEEP_ALIVE: c(0x5, 1),
    SAVE: fun(0x6, saveLength),
    LOAD: fun(0x7, saveLength),
    RESTART: c(0x8, 1),
    SELECT: fun(0x9, selectLength),
    SELECTION_ADD: fun(0xa, selectLength),
    SELECTION_REMOVE: fun(0xb, selectLength),
    BUILD: c(0xc, 8),
    VISION: c(0xd, 3),
    ALLIANCE: c(0xe, 5),
    GAME_SPEED: c(0xf, 2),
    PAUSE: c(0x10, 1),
    RESUME: c(0x11, 1),
    CHEAT: c(0x12, 5),
    HOTKEY: c(0x13, 3),
    RIGHT_CLICK: c(0x14, 10),
    TARGETED_ORDER: c(0x15, 11),
    CANCEL_BUILD: c(0x18, 1),
    CANCEL_MORPH: c(0x19, 1),
    STOP: c(0x1a, 2),
    CARRIER_STOP: c(0x1b, 1),
    REAVER_STOP: c(0x1c, 1),
    ORDER_NOTHING: c(0x1d, 1),
    RETURN_CARGO: c(0x1e, 2),
    TRAIN: c(0x1f, 3),
    CANCEL_TRAIN: c(0x20, 3),
    CLOAK: c(0x21, 2),
    DECLOAK: c(0x22, 2),
    UNIT_MORPH: c(0x23, 3),
    UNSIEGE: c(0x25, 2),
    SIEGE: c(0x26, 2),
    TRAIN_FIGHTER: c(0x27, 1),
    UNLOAD_ALL: c(0x28, 2),
    UNLOAD: c(0x29, 3),
    MERGE_ARCHON: c(0x2a, 1),
    HOLD_POSITION: c(0x2b, 2),
    BURROW: c(0x2c, 2),
    UNBURROW: c(0x2d, 2),
    CANCEL_NUKE: c(0x2e, 1),
    LIFTOFF: c(0x2f, 5),
    TECH: c(0x30, 2),
    CANCEL_TECH: c(0x31, 1),
    UPGRADE: c(0x32, 2),
    CANCEL_UPGRADE: c(0x33, 1),
    CANCEL_ADDON: c(0x34, 1),
    BUILDING_MORPH: c(0x35, 3),
    STIM: c(0x36, 1),
    SYNC: c(0x37, 7),
    VOICE_ENABLE1: c(0x38, 1),
    VOICE_ENABLE2: c(0x39, 1),
    VOICE_SQUELCH1: c(0x3a, 2),
    VOICE_SQUELCH2: c(0x3b, 2),
    START_GAME: c(0x3c, 1),
    DOWNLOAD_PERCENTAGE: c(0x3d, 2),
    CHANGE_GAME_SLOT: c(0x3e, 6),
    NEW_NET_PLAYER: c(0x3f, 8),
    JOINED_GAME: c(0x40, 18),
    CHANGE_RACE: c(0x41, 3),
    TEAM_GAME_TEAM: c(0x42, 2),
    UMS_TEAM: c(0x43, 2),
    MELEE_TEAM: c(0x44, 3),
    SWAP_PLAYERS: c(0x45, 3),
    SAVED_DATA: c(0x48, 13),
    BRIEFING_START: c(0x54, 1),
    LATENCY: c(0x55, 2),
    REPLAY_SPEED: c(0x56, 10),
    LEAVE_GAME: c(0x57, 2),
    MINIMAP_PING: c(0x58, 5),
    MERGE_DARK_ARCHON: c(0x5a, 1),
    MAKE_GAME_PUBLIC: c(0x5b, 1),
    CHAT: c(0x5c, 82),
    SET_TURN_RATE: c(0x5f, 0x2),
    RIGHT_CLICK_EXT: c(0x60, 0xc),
    TARGETED_ORDER_EXT: c(0x61, 0xd),
    UNLOAD_EXT: c(0x62, 5),
    SELECT_EXT: fun(0x63, extSelectLength),
    SELECTION_ADD_EXT: fun(0x64, extSelectLength),
    SELECTION_REMOVE_EXT: fun(0x65, extSelectLength),
    NEW_NETWORK_SPEED: c(0x66, 4),
  };
})();

for (const key of Object.keys(CMDS)) {
  CMDS[key].name = key;
  CMDS[CMDS[key].id] = CMDS[key];
}

function commandLength(id, data) {
  const cmd = CMDS[id];
  if (!cmd) {
    return null;
  }
  return cmd.length(data);
}

//https://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-a-range-within-the-supp
const range = (startAt, size) => {
  return [...Array(size).keys()].map((i) => i + startAt);
};

const inflate = (buf) =>
  new Promise((res, rej) => {
    const decoder =
      buf.readUInt8(0) === 0x78
        ? zlib.createInflate()
        : new Transform({ transform: explode() });

    new Readable({
      read: function () {
        this.push(buf);
        this.push(null);
      },
    })
      .pipe(decoder)
      .pipe(
        new Writable({
          write(inf, enc, done) {
            res(inf);
            done();
          },
        })
      );
  });

const deflate = async (buf) =>
  new Promise((res, rej) => {
    const t = new Transform({
      transform: implode(BINARY_COMPRESSION, DICTIONARY_SIZE3),
    });

    new Readable({
      read: function () {
        this.push(buf);
        this.push(null);
      },
    })
      .pipe(t)
      .pipe(
        new Writable({
          write(def, enc, done) {
            res(def);
            done();
          },
        })
      );
  });

const block = async (buf, blockSize) => {
  const checksum = buf.readUInt32LE(0);
  const chunkCount = buf.readUInt32LE(4);
  buf.consume(8);

  const expectedChunks = Math.ceil(blockSize / MAX_CHUNK_SIZE);
  if (chunkCount !== expectedChunks) {
    throw new Error(`Expected ${expectedChunks} chunks, got ${chunkCount}`);
  }
  const chunks = [];

  const actualBlockSize = range(0, chunkCount).reduce((pos) => {
    const chunkSize = buf.readUInt32LE(pos);
    buf.consume(4);

    chunks.push({
      buf: buf.slice(pos, pos + chunkSize),
    });

    return pos + chunkSize;
  }, 0);

  buf.consume(actualBlockSize);

  const isDeflated = actualBlockSize < blockSize;

  let deflated = await Promise.all(
    chunks.map((chunk) => (isDeflated ? inflate(chunk.buf) : chunk.buf))
  );

  const result = deflated.reduce(
    (buf, chunk) => buf.append(chunk),
    new BufferList()
  );

  // @todo these fail on 2nd last block size for 116 reps, 2nd last block doesn't get
  // deflated to 8192 but only 4096 :S
  // if (result.length != blockSize)
  //   throw new Error(`read bytes, expected:${blockSize} got:${result.length}`);

  // const calcChecksum = crc32(result.slice(0));
  // if (calcChecksum !== checksum) {
  //   throw new Error(`crc32 mismatch expected:${checksum} got:${calcChecksum}`);
  // }

  return result;
};

const Version = {
  classic: 0,
  remastered: 1,
};

const parseReplay = async (buf) => {
  const bl = new BufferList();
  bl.append(buf);

  const magic = (await block(bl, 4)).readUInt32LE(0);
  let version = -1;

  if (magic === HeaderMagicClassic) {
    version = Version.classic;
  } else if (magic === HeaderMagicScrModern) {
    version = Version.remastered;
  } else {
    throw new Error("not a replay");
  }
  if (version === Version.remastered) {
    // there are juicy scr data blocks at this offset but we'll skip it for our use case
    bl.consume(4);
  }

  const rawHeader = await block(bl, 0x279);
  const players = range(0, 8).map((i) => {
    const offset = 0xa1 + 0x24 * i;
    const stormId = rawHeader.readInt32LE(offset + 0x4);
    if (stormId >= 0) {
      return rawHeader.readUInt32LE(offset);
    }
  });

  console.log("header");
  const header = parseHeader(rawHeader);
  console.log("header", header);

  const cmdsSize = (await block(bl, 4)).readUInt32LE(0);
  console.log("commands");
  const rawCmds = await block(bl, cmdsSize);
  const cmds = parseCommands(rawCmds, players);

  console.log("chk");
  const chkSize = (await block(bl, 4)).readUInt32LE(0);
  const chk = await block(bl, chkSize);

  return {
    version,
    rawHeader,
    header,
    rawCmds,
    cmds,
    chk,
  };
};

const cstring = (buf) => {
  let text = buf;
  const end = buf.indexOf(0);
  if (end !== -1) {
    text = buf.slice(0, end);
  }

  const string = iconv.decode(text, "cp949");
  if (string.indexOf("\ufffd") !== -1) {
    return iconv.decode(text, "cp1252");
  } else {
    return string;
  }
};

const parseHeader = (buf) => {
  let pos = 0;
  const nextUint8 = () => {
    const v = buf.readUInt8(pos);
    pos = pos + 1;
    return v;
  };
  const nextUint16 = () => {
    const v = buf.readInt16LE(pos);
    pos = pos + 2;
    return v;
  };
  const nextUint32 = () => {
    const v = buf.readUInt32LE(pos);
    pos = pos + 4;
    return v;
  };
  const next = (n) => {
    const v = buf.slice(pos, pos + n);
    pos = pos + n;
    return v;
  };

  const isBroodwar = nextUint8();
  const frameCount = nextUint32();
  const campaignId = nextUint16();
  const commandByte = nextUint8(1);

  const randomSeed = nextUint32();
  const playerBytes = next(8);
  const unk1 = nextUint32();
  const playerName = next(24);

  const gameFlags = nextUint32();
  const mapWidth = nextUint16();
  const mapHeight = nextUint16();
  const activePlayerCount = nextUint8();

  const slotCount = nextUint8();
  const gameSpeed = nextUint8();
  const gameState = nextUint8();
  const gameType = nextUint16();

  const gameSubtype = nextUint16();
  const unk2 = nextUint32();
  const tileset = nextUint16();
  const replayAutoSave = nextUint8();

  const computerPlayerCount = nextUint8();
  const gameName = cstring(next(25));
  const mapName = cstring(next(32));
  const unk3 = nextUint16();

  const unk4 = nextUint16();
  const unk5 = nextUint16();
  const unk6 = nextUint16();
  const victoryCondition = nextUint8();

  const resourceType = nextUint8();
  const useStandardUnitStats = nextUint8();
  const fogOfWarEnabled = nextUint8();
  const createInitialUnits = nextUint8();

  const useFixedPositions = nextUint8();
  const restrictionFlags = nextUint8();
  const alliesEnabled = nextUint8();
  const teamsEnabled = nextUint8();

  const cheatsEnabled = nextUint8();
  const tournamentMode = nextUint8();
  const victoryConditionValue = nextUint32();
  const startingMinerals = nextUint32();

  const startingGas = nextUint32();
  const unk7 = nextUint8();

  const raceStr = (race) => {
    switch (race) {
      case 0:
        return "zerg";
      case 1:
        return "terran";
      case 2:
        return "protoss";
      default:
        return "unknown";
    }
  };
  const players = [];
  for (let i = 0; i < 8; i++) {
    const offset = 0xa1 + 0x24 * i;
    const type = buf.readUInt8(offset + 0x8);
    if (type === 1 || type === 2) {
      players.push({
        id: buf.readUInt32LE(offset),
        isComputer: type === 1,
        race: raceStr(buf.readUInt8(offset + 0x9)),
        name: cstring(buf.slice(offset + 0xb, offset + 0xb + 0x19)),
        team: buf.readUInt8(offset + 0xa),
      });
    }
  }
  return {
    isBroodwar,
    gameName,
    mapName,
    gameType,
    gameSubtype,
    players,
    frameCount,
    randomSeed,
    ancillary: {
      campaignId,
      commandByte,
      playerBytes,
      unk1,
      playerName,
      gameFlags,
      mapWidth,
      mapHeight,
      activePlayerCount,
      slotCount,
      gameSpeed,
      gameState,
      unk2,
      tileset,
      replayAutoSave,
      computerPlayerCount,
      unk3,
      unk4,
      unk5,
      unk6,
      victoryCondition,
      resourceType,
      useStandardUnitStats,
      fogOfWarEnabled,
      createInitialUnits,
      useFixedPositions,
      restrictionFlags,
      alliesEnabled,
      teamsEnabled,
      cheatsEnabled,
      tournamentMode,
      victoryConditionValue,
      startingMinerals,
      startingGas,
      unk7,
    },
  };
};

const parseCommands = (origBuf, players) => {
  const buf = origBuf.duplicate();
  const commands = [];
  while (true) {
    if (buf.length < 5) {
      return commands;
    }
    const frameLength = buf.readUInt8(4);
    const frameEnd = 5 + frameLength;
    if (buf.length < frameEnd) {
      return commands;
    }
    const frame = buf.readUInt32LE(0);
    let pos = 5;
    while (pos < frameEnd) {
      const player = players[buf.readUInt8(pos)];
      pos += 1;
      const id = buf.readUInt8(pos);
      const len = commandLength(id, buf.slice(pos + 1));
      if (len === null || pos + len > frameEnd) {
        //@todo error?
        return commands;
      }
      const data = buf.slice(pos + 1, pos + len);
      pos += len;

      if (!commands[frame]) {
        commands[frame] = [];
      }
      commands[frame].push(
        Object.assign(
          {
            frame,
            id,
            player,
            data,
          },
          dataToCommand(id, data)
        )
      );
    }
    buf.consume(frameEnd);
  }
};

const dataToCommand = (id, buf) => {
  switch (id) {
    case CMDS.RIGHT_CLICK.id:
      return {
        x: buf.readUInt16LE(0),
        y: buf.readUInt16LE(2),
        unitTag: buf.readUInt16LE(4),
        unit: buf.readUInt16LE(6),
        queued: buf.readUInt8(8) != 0,
      };

    case CMDS.RIGHT_CLICK_EXT.id: {
      const data = new BufferList();
      data.append(buf.slice(0, 6)).append(buf.slice(8, 11));

      return {
        data,
        id: CMDS.RIGHT_CLICK.id,
        x: buf.readUInt16LE(0),
        y: buf.readUInt16LE(2),
        unitTag: buf.readUInt16LE(4),
        unit: buf.readUInt16LE(8),
        queued: buf.readUInt8(10) != 0,
      };
    }

    case CMDS.SELECT.id:
    case CMDS.SELECTION_ADD.id:
    case CMDS.SELECTION_REMOVE.id: {
      const count = buf.readUInt8(0);
      const unitTags = range(0, count).map((i) => buf.readUInt16LE(1 + i * 2));
      return {
        unitTags,
      };
    }
    case CMDS.SELECT_EXT.id:
    case CMDS.SELECTION_ADD_EXT.id:
    case CMDS.SELECTION_REMOVE_EXT.id: {
      const mapping = {};
      mapping[CMDS.SELECT_EXT.id] = CMDS.SELECT;
      mapping[CMDS.SELECTION_ADD_EXT.id] = CMDS.SELECTION_ADD;
      mapping[CMDS.SELECTION_REMOVE_EXT.id] = CMDS.SELECTION_REMOVE;

      const count = buf.readUInt8(0);
      const unitTags = range(0, count).map((i) => buf.readUInt16LE(1 + i * 4));
      const bwUnitTags = new Uint16Array(count);
      unitTags.forEach((val, i) => (bwUnitTags[i] = val));
      const data = new BufferList();
      data.append(buf.slice(0, 1)).append(Buffer.from(bwUnitTags));
      return {
        data,
        id: mapping[id].id,
        unitTags,
      };
    }
    case CMDS.HOTKEY.id:
      return {
        hotkeyType: buf.readUInt8(0),
        group: buf.readUInt8(1),
      };
    case CMDS.TRAIN.id:
    case CMDS.UNIT_MORPH.id:
      return {
        unitTypeId: buf.readUInt16LE(0),
      };
    case CMDS.TARGETED_ORDER.id:
      return {
        x: buf.readUInt16LE(0),
        y: buf.readUInt16LE(2),
        unitTag: buf.readUInt16LE(4),
        unitTypeId: buf.readUInt16LE(6),
        order: buf.readUInt8(8),
        queued: buf.readUInt8(9) != 0,
      };
    case CMDS.TARGETED_ORDER_EXT.id:
      return {
        id: CMDS.TARGETED_ORDER.id,
        x: buf.readUInt16LE(0),
        y: buf.readUInt16LE(2),
        unitTag: buf.readUInt16LE(4),
        unitTypeId: buf.readUInt16LE(8),
        order: buf.readUInt8(10),
        queued: buf.readUInt8(11) != 0,
      };
    case CMDS.BUILD.id:
      return {
        order: buf.readUInt8(0),
        x: buf.readUInt16LE(1),
        y: buf.readUInt16LE(3),
        unitTypeId: buf.readUInt16LE(5),
      };
    case CMDS.STOP.id:
    case CMDS.BURROW.id:
    case CMDS.UNBURROW.id:
    case CMDS.RETURN_CARGO.id:
    case CMDS.HOLD_POSITION.id:
    case CMDS.UNLOAD_ALL.id:
    case CMDS.UNSIEGE.id:
    case CMDS.SIEGE.id:
    case CMDS.CLOAK.id:
    case CMDS.DECLOAK.id:
      return {
        queued: buf.readUInt8(0) != 0,
      };

    case CMDS.MINIMAP_PING.id:
      return {
        x: buf.readUInt16LE(0),
        y: buf.readUInt16LE(2),
      };

    case CMDS.CHAT.id:
      return {
        senderSlot: buf.readUInt8(0),
        //@todo figure out length
        message: cstring(buf.slice(1, 80)),
      };
    case CMDS.CANCEL_TRAIN.id:
      return {
        unitTag: buf.readInt16LE(0),
      };
    case CMDS.UNLOAD.id:
    case CMDS.UNLOAD_EXT.id:
      return {
        id: CMDS.UNLOAD.id,
        unitTag: buf.readInt16LE(0),
      };

    case CMDS.LIFTOFF.id:
      return {
        x: buf.readInt16LE(0),
        y: buf.readInt16LE(2),
      };

    case CMDS.TECH.id:
      return {
        tech: buf.readUInt8(0),
      };
    case CMDS.UPGRADE.id:
      return {
        upgrade: buf.readUInt8(0),
      };
    case CMDS.BUILDING_MORPH.id:
      return {
        unitTypeId: buf.readUInt16LE(0),
      };
    default:
      return {
        buf,
      };
  }
};

const convertReplayTo116 = async (buf) => {
  const replay = await parseReplay(buf);
  if (replay.version === Version.classic) {
    return buf;
  }
  const bl = new BufferList();
  const alloc = (n, cb) => {
    const b = Buffer.alloc(n);
    cb(b);
    return b;
  };
  const uint32le = (val) => alloc(4, (b) => b.writeUInt32LE(val));
  const uint8 = (val) => alloc(1, (b) => b.writeUInt8(val));

  await writeBlock(bl, uint32le(HeaderMagicClassic), false);
  await writeBlock(bl, replay.rawHeader);

  const commands = replay.cmds
    .map((commands, i) => ({
      commands,
      frame: i,
    }))
    .filter(({ commands }) => commands && commands.length >= 0)
    .reduce((cmdBl, { commands, frame }) => {
      cmdBl.append(uint32le(frame));

      const size = commands.reduce((size, { data }) => {
        return size + data.length + 2;
      }, 0);
      cmdBl.append(uint8(size));

      commands.forEach(({ data, player, id }) => {
        cmdBl.append(uint8(player));
        cmdBl.append(uint8(id));
        cmdBl.append(data.length);
      });

      return cmdBl;
    }, new BufferList());

  await writeBlock(bl, uint32le(commands.length), false);
  await writeBlock(bl, commands);
  await writeBlock(bl, uint32le(replay.chk.length), false);
  await writeBlock(bl, replay.chk);

  return bl.slice(0);
};

const writeBlock = async (out, data, compress = true) => {
  const numChunks = Math.ceil(data.length / MAX_CHUNK_SIZE);
  let checksum = crc32(data);

  const chunkPromises = range(0, numChunks).map((i) => {
    const chunk = data.slice(
      i * MAX_CHUNK_SIZE,
      i * MAX_CHUNK_SIZE + Math.min(MAX_CHUNK_SIZE, data.length)
    );
    return compress ? deflate(chunk) : chunk;
  });

  const chunks = [];
  for (let i = 0; i < chunkPromises.length; i++) {
    const chunk = await chunkPromises[i];
    chunks.push(chunk);
  }

  out.append(new Uint32Array([checksum]));
  out.append(new Uint32Array([numChunks]));

  chunks.forEach((chunk) => {
    out.append(new Uint32Array([chunk.byteLength]));
    out.append(chunk);
  });
};

module.exports = {
  parseReplay,
  convertReplayTo116,
};
