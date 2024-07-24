# Attendance Monitoring

make sure you change the save location in config.json

Packaged: `resources/app/config.json`
Development: `config.json`

``` bash
bun i
bun run tauri dev
```

## User Guide

![read below for text description](./User%20Guide.png)

- On the first screen select the card reader you want to use or select the mock reader if you just want to look around.
- On the second screen enter your location and stick to the naming convention you department chose.
- On the last screen you will be able to see where the data is being saved to (this is set by your department) and you will be able to see the info read off the cards. Errors will also show up here and ask you to rescan the card.
