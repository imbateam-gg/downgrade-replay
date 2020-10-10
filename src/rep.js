// based HEAVILY on jssuh & screp <3
// uses a local copy of https://github.com/meszaros-lajos-gyorgy/node-pkware

const { BufferList, BufferListStream } = require("bl");
const { Writable, Readable, Transform } = require("stream");
const concat = require("concat-stream");
const crc32 = require("buffer-crc32");

const iconv = require("iconv-lite");
const {
  DICTIONARY_SIZE3,
  implode,
  explode,
  BINARY_COMPRESSION,
} = require("../libs/node-pkware/src");

const decodeImplode = require("implode-decoder");
const zlib = require("zlib");

const HeaderMagicClassic = 0x53526572;
const HeaderMagicScrModern = 0x53526573;
const MAX_CHUNK_SIZE = 0x2000;

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
    const t = new Transform({ transform: implode() });

    new Readable({
      read: function () {
        this.push(buf);
        this.push(null);
      },
    })
      .pipe(t)
      .pipe(concat)
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
    throw new Error(`Excepted ${expectedChunks} chunks, got ${chunkCount}`);
  }
  const chunks = [];

  const actualBlockSize = range(0, chunkCount).reduce((pos, i) => {
    const chunkSize = buf.readUInt32LE(pos);
    buf.consume(4);

    const remaining = blockSize - pos;
    const deflated = chunkSize < Math.min(remaining, MAX_CHUNK_SIZE);

    chunks.push({
      buf: buf.slice(pos, pos + chunkSize),
      deflated,
    });

    return pos + chunkSize;
  }, 0);

  buf.consume(actualBlockSize);

  let deflated = await Promise.all(
    chunks.map((chunk) => (chunk.deflated ? inflate(chunk.buf) : chunk.buf))
  );

  const result = deflated.reduce(
    (buf, chunk) => buf.append(chunk),
    new BufferList()
  );

  if (result.length != blockSize)
    throw new Error(`read bytes, expected:${blockSize} got:${result.length}`);

  // const calcChecksum = crc32(result.slice(0));
  // if (calcChecksum !== checksum) {
  //   throw new Error(`crc32 mismatch expected:${checksum} got:${calcChecksum}`);
  // } else {
  //   console.log(`crc32 match expected:${checksum} got:${calcChecksum}`);
  // }

  return result;
};

const Version = {
  classic: 0,
  scr: 1,
  scrModern: 2,
};

const parseReplay = async (buf) => {
  const bl = new BufferList();
  bl.append(buf);

  const magic = (await block(bl, 4)).readUInt32LE(0);
  let version = -1;

  if (magic === HeaderMagicClassic) {
    version = Version.classic;
  } else if (magic === HeaderMagicScrModern) {
    version = Version.scrModern;
  } else {
    throw new Error("not a replay");
  }
  if (version === Version.scrModern) {
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
  const gameName = cstring(buf.slice(0x18, 0x18 + 0x18));
  const mapName = cstring(buf.slice(0x61, 0x61 + 0x20));
  const gameType = buf.readUInt16LE(0x81);
  const gameSubtype = buf.readUInt16LE(0x83);
  const durationFrames = buf.readUInt32LE(0x1);
  const seed = buf.readUInt32LE(0x8);

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
    gameName,
    mapName,
    gameType,
    gameSubtype,
    players,
    durationFrames,
    seed,
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
      const to116 = new BufferList();
      to116.append(buf.slice(0, 6)).append(buf.slice(8, 11));

      return {
        to116,
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
      const to116 = new BufferList();
      to116.append(buf.slice(0, 1)).append(Buffer.from(bwUnitTags));
      return {
        to116,
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

class AlreadyClassicError extends Error {}

const convertReplayTo116 = async (buf) => {
  const replay = await parseReplay(buf);
  if (replay.version === Version.classic) {
    throw new AlreadyClassicError("replay already 116");
  }
  const bl = new BufferList();

  writeBlock(bl, Buffer.from(new Uint32Array([HeaderMagicClassic])));
  writeBlock(bl, replay.rawHeader);

  const commands = replay.cmds
    .map((commands, i) => ({
      commands,
      frame: i,
    }))
    .filter(({ frame }) => frame >= 0)
    .reduce((bl, { commands, frame }) => {
      bl.append(new Uint32Array([frame]));

      const size = commands.reduce((size, { to116, data }) => {
        const bytes = to116 || data;
        return size + bytes.length;
      }, 0);
      bl.append(new Uint8Array([size]));

      commands.forEach(({ to116, data }) => {
        const bytes = to116 || data;
        bl.append(bytes.length);
        return bl;
      });
    }, new BufferList());

  bl.append(Buffer.from(new Uint32Array([commands.length])));
  writeBlock(bl, commands);

  bl.append(Buffer.from(new Uint32Array([replay.chk.length])));
  writeBlock(bl, replay.chk);
  return bl;
};

const writeBlock = (buf, data) => {
  const checksum = buf.length;
  buf.append(Buffer.from(new Uint32Array([checksum])));
  buf.append(
    Buffer.from(new Uint32Array([Math.ceil(data.length / MAX_CHUNK_SIZE)]))
  );
  buf.append(data);
};

module.exports = {
  parseReplay,
  convertReplayTo116,
  AlreadyClassicError,
};
