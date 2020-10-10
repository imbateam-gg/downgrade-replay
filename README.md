# downgrade-replay

Downgrade Starcraft Remastered replays to 1.116

TBD: Output compression and final output structure

### Features
- Parses both 1.16 and SCR replays
- Can convert from SCR to 1.16 to be used in Starcraft 1.16

### Currently working
- Parse header & player information, command information, as well as chk Buffer for use in a library like `bw-chk`
