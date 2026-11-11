"use strict";
// フォルダの右クリックに「新規作成」を足す。
// 規則ごとに: ファイル名 = moment 形式の今日の日付、中身 = 規則に合う最新ファイル or テンプレート。
const { Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice, normalizePath, moment } = require("obsidian");

const DEFAULT_SETTINGS = {
  rules: [],
};

// テンプレート用の置換。コアの Templates と同じ {{date}} {{time}} {{title}} と、{{date:FORMAT}} を扱う。
function expand(text, title, now) {
  return text
    .replace(/\{\{date:([^}]+)\}\}/g, (_, f) => now.format(f))
    .replace(/\{\{time:([^}]+)\}\}/g, (_, f) => now.format(f))
    .replace(/\{\{date\}\}/g, now.format("YYYY-MM-DD"))
    .replace(/\{\{time\}\}/g, now.format("HH:mm"))
    .replace(/\{\{title\}\}/g, title);
}

// フォルダ直下で、basename が nameFormat に厳密に合うファイルのうち日付が最大のもの。
// 今日より後の日付は年の打ち間違い（20260709 のつもりで 20270709 など）とみなして除く。
function latestByRule(folder, nameFormat, now) {
  const limit = now.clone().endOf("day");
  let best = null;
  let bestAt = null;
  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    const at = moment(child.basename, nameFormat, true);
    if (!at.isValid() || at.isAfter(limit)) continue;
    if (!bestAt || at.isAfter(bestAt)) {
      best = child;
      bestAt = at;
    }
  }
  return best;
}

module.exports = class FolderNewPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FolderNewSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        for (const rule of this.rulesFor(file)) {
          const label = rule.source === "latest" ? "前回から新規作成" : "テンプレートから新規作成";
          menu.addItem((item) =>
            item
              .setTitle(`${label} (${moment().format(rule.nameFormat)})`)
              .setIcon("file-plus")
              .setSection("action-primary")
              .onClick(() => this.create(file, rule).catch((e) => new Notice(`Folder New: ${e.message}`)))
          );
        }
      })
    );

    // 規則ごとにコマンドも出す（ホットキーを割り当てられるように）。
    this.settings.rules.forEach((rule, i) => {
      this.addCommand({
        id: `create-${i}`,
        name: `${rule.folder} に新規作成`,
        callback: () => {
          const folder = this.app.vault.getAbstractFileByPath(normalizePath(rule.folder));
          if (!(folder instanceof TFolder)) return new Notice(`フォルダがない: ${rule.folder}`);
          this.create(folder, rule).catch((e) => new Notice(`Folder New: ${e.message}`));
        },
      });
    });
  }

  rulesFor(folder) {
    return this.settings.rules.filter((r) => r.folder && normalizePath(r.folder) === folder.path);
  }

  async create(folder, rule) {
    const now = moment();
    const title = now.format(rule.nameFormat);
    const path = normalizePath(`${folder.path}/${title}.md`);

    // 既にあれば上書きせず開くだけ。
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      new Notice(`もうある: ${path}`);
      return this.open(existing);
    }

    let content = "";
    const prev = rule.source === "latest" ? latestByRule(folder, rule.nameFormat, now) : null;
    if (prev) {
      content = await this.app.vault.read(prev);
    } else if (rule.template) {
      // latest で前回が見つからない場合もテンプレートに戻る。
      const tpl = this.app.vault.getAbstractFileByPath(normalizePath(rule.template));
      if (!(tpl instanceof TFile)) throw new Error(`テンプレートがない: ${rule.template}`);
      content = expand(await this.app.vault.read(tpl), title, now);
    }

    const file = await this.app.vault.create(path, content);
    new Notice(prev ? `${prev.basename} から作成: ${path}` : `作成: ${path}`);
    return this.open(file);
  }

  async open(file) {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

class FolderNewSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "フォルダごとの規則。ファイル名は moment 形式（例: YYYYMMDD）。コマンドの追加・削除は再読み込み後に反映される。",
    });

    const save = () => this.plugin.saveSettings();

    this.plugin.settings.rules.forEach((rule, i) => {
      new Setting(containerEl)
        .setName(`規則 ${i + 1}`)
        .addText((t) => t.setPlaceholder("フォルダ (例: work/daily)").setValue(rule.folder).onChange((v) => { rule.folder = v.trim(); save(); }))
        .addText((t) => t.setPlaceholder("ファイル名形式").setValue(rule.nameFormat).onChange((v) => { rule.nameFormat = v.trim(); save(); }))
        .addDropdown((d) =>
          d.addOption("latest", "前回から").addOption("template", "テンプレート").setValue(rule.source).onChange((v) => { rule.source = v; save(); })
        )
        .addText((t) => t.setPlaceholder("テンプレート (例: template/x.md)").setValue(rule.template).onChange((v) => { rule.template = v.trim(); save(); }))
        .addExtraButton((b) =>
          b.setIcon("trash").setTooltip("削除").onClick(async () => {
            this.plugin.settings.rules.splice(i, 1);
            await save();
            this.display();
          })
        );
    });

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("規則を追加").onClick(async () => {
        this.plugin.settings.rules.push({ folder: "", nameFormat: "YYYYMMDD", source: "latest", template: "" });
        await save();
        this.display();
      })
    );
  }
}
