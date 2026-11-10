# Folder New

An Obsidian plugin that adds a context-menu item to configured folders. It creates a note named with today's date and fills it in from the newest note in that folder, or from a template.

Good for notes you make the same way every time, like daily reports where each one starts as a copy of the last.

## Usage

Settings → Folder New → add a rule:

| Field | Example | Meaning |
|---|---|---|
| Folder | `work/daily` | The folder the rule applies to (an exact match; subfolders are not included) |
| File name format | `YYYYMMDD` | A [moment.js](https://momentjs.com/docs/#/displaying/format/) format for the new note's name |
| Source | Latest / Template | Copy the newest note whose name matches the format, or use a template |
| Template | `templates/daily.md` | A template file, also used when there is no earlier note |

Right-click the folder and choose **前回から新規作成** (create from the previous note) or **テンプレートから新規作成** (create from the template).

- If a note with today's name already exists, it is opened and not overwritten.
- Templates expand `{{date}}`, `{{time}}`, `{{title}}`, `{{date:FORMAT}}` and `{{time:FORMAT}}`.
- Each rule also adds a command, so you can bind a hotkey to it. Changes to commands take effect after reloading the plugin.

## Install

With [BRAT](https://github.com/TfTHacker/obsidian42-brat): Add Beta plugin → `azihsoyn/obsidian-folder-new`.

Manually: copy `main.js` and `manifest.json` from the latest release into `<vault>/.obsidian/plugins/folder-new/`.

No build step is needed; `main.js` is the source.
