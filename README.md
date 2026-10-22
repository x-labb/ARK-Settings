# ARK Settings

Pick your **ARK: Survival Ascended** server settings in a clean UI and get the files ready to drop in:
`GameUserSettings.ini`, `Game.ini` and the launch command.

It only builds config. It doesn't start, update or host servers. Use it alongside AMP, Nitrado, or whatever runs your server.

## What it does

- **About 350 ASA settings** in 13 categories (server, rates, dinos, breeding, structures, PvP…), each with a description, its default value, and the file it goes in.
- **Live output.** The three files update as you type, and only settings you changed are written.
- **Stat multipliers** grid for survivors, wild and tamed creatures (`PerLevelStatsMultiplier_*`, `PlayerBaseStatMultipliers`).
- **Class overrides:** per-resource harvest amounts, per-species damage and resistance, creature replacements, and engram auto-unlocks.
- **Custom lines** for anything else (`ConfigOverride…`, supply crates, spawn entries).
- **Import** your existing files. The importer joins settings split over several lines, moves keys that sit in the wrong file or section, and skips the client graphics settings that end up in a copied `GameUserSettings.ini`. It keeps unknown keys as custom lines and lists every change it made.
- **Checks** for common mistakes, such as RCON on with a weak admin password, or an idle kick timer without `-EnableIdlePlayerKick`.
- **Host panel mode** leaves out what panels like AMP fill in themselves (name, passwords, ports, slots, mods). It also gives you the extra launch arguments on their own.
- **Presets** you can save and load as JSON (passwords are never included), plus light and dark themes.

Everything stays in your browser (`localStorage`). There's no backend, no account, and no tracking.

## Using the files

1. Stop the server. ARK rewrites `GameUserSettings.ini` when it shuts down, so edits made while it runs are lost.
2. Put both files in `ShooterGame\Saved\Config\WindowsServer\`.
3. Start the server with the launch command, or add the extra arguments in your panel.

## Run it locally

It's a static site with no build step and no dependencies. Serve the folder with any static server, for example:

```bash
python -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

To publish it, enable **GitHub Pages** on the repository (Settings → Pages → deploy from the `main` branch, root folder).

## Project layout

```
index.html            page shell
css/styles.css        all styles (light and dark themes)
js/main.js            routing, top bar, presets
js/catalog.js         categories, stat tables, class-override definitions
js/data/settings.js   the settings catalog (keys, defaults, descriptions)
js/data/classes.js    class-name suggestions
js/generate.js        builds the three outputs
js/import.js          reads existing files back in
js/checks.js          warnings shown next to the output
js/ui/                views, controls, output panel, import dialog
```

## Accuracy

Setting keys, defaults and file placement come from the [ARK wiki's server configuration page](https://ark.wiki.gg/wiki/Server_configuration).
Some settings are inherited from ARK: Survival Evolved and are marked "unknown" for ASA on the wiki. They are included because they very likely still work, but they haven't been verified on ASA.
If a setting is wrong or missing, fix its entry in `js/data/settings.js`. Each entry is a plain object.

## License

[MIT](LICENSE)
