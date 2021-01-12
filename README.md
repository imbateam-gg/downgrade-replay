# downgrade-replay

Downgrade Starcraft Remastered replays to 1.16

### Features
- Parses both 1.16 and SCR replays
- Can convert from SCR to 1.16 to be used in Starcraft 1.16

### Currently working
- Parse header & player information, command information, as well as chk Buffer for use in a library like `shieldbattery/bw-chk`

### Not working
- Not quite working yet :(
- Crashes in 1.16, opens in openbw but the commands aren't executing correctly (although they are being calculated in apm :S)
- SCR map like Eclipse is missing tiles, does this mean we need to add vx4ex support to openbw?
