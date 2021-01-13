# downgrade-replay

Downgrade Starcraft Remastered replays to 1.16

### Usage
`npm install`
`node src/example.js <replay file>` will write converted replay to out.116.rep

### Features
- Parses both 1.16 and SCR replays
- Downgrades from SCR to 1.16 to be used in Starcraft 1.16

### What happens with a downgrade?
- Replay: 
  - Changes replay version to Broodwar
  - Omits SCR sections
  - Convert extended commands back to broodwar commands
  - Compresses chunks using pkware implode
  
- Map:
  - Changes map type from SCR to Hybrid, and Broodwar Remastered to Broodwar
  - Converts STRx section to STR
  - Omits CRGB section if it exists

- Reads and re-writes 1.16 successfully (working in 1.16 and openbw)
- Reads and re-writes SCR to 1.16 albeit not fully working in 1.16 or openbw

### Not working
- Converted replay crashes in 1.16, opens in openbw but the commands aren't executing correctly (although they are being calculated in apm :S)
- SCR map like Eclipse is missing tiles, does this mean we need to add vx4ex support to openbw?
