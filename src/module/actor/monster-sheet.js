/**
 * @file The sheet class for Actors of type Monster
 */
import OSE from "../config";
import logger from "../logger.js";
import OseActorSheet from "./actor-sheet";

export default class OseActorSheetMonster extends OseActorSheet {
  /**
   * Override default options for Monster sheet
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "monster", "actor"],
      width: 450,
    });
  }

  /**
   * Organize and classify Items for Monster sheets.
   * @param {object} context The sheet context data.
   * @override
   */
  _prepareSheetData(context) {
    logger.debug(`Preparing Monster sheet data for ${this.actor.name}`);
    const attacks = [];
    const abilities = [];
    const spells = {};

    if (context.system.spells.enabled) {
      for (let lvl = 1; lvl <= context.system.spells.max; lvl++) {
        spells[lvl] = {
          label: game.i18n.format("OSE.spell.level", { level: lvl }),
          items: [],
          dataset: { type: "spell", lvl: lvl }
        };
      }
    }

    for (const i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      if (i.type === "weapon") attacks.push(i);
      else if (i.type === "ability") abilities.push(i);
      else if (i.type === "spell" && spells[i.system.lvl]) {
        spells[i.system.lvl].items.push(i);
      }
    }

    context.attacks = attacks;
    context.abilities = abilities;
    context.spells = Object.values(spells);
  }

  /**
   * Prepare full rendering context, including enriched HTML fragments.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    logger.debug(`Preparing monster-specific context for ${this.actor.name}`);

    const monsterData = context.system;
    context.config.morale = game.settings.get(game.system.id, "morale");

    if (monsterData.details.treasure?.table) {
      context.treasureLink = await foundry.applications.ux
        .TextEditor.implementation.enrichHTML(monsterData.details.treasure.table, { async: true, relativeTo: this.actor });
    }
    context.enrichedBiography = await foundry.applications.ux
      .TextEditor.implementation.enrichHTML(monsterData.details.biography || "", { async: true, relativeTo: this.actor });

    return context;
  }

  /**
   * Open dialog to generate monster saves.
   */
  async generateSave() {
    logger.info(`Generating saves for monster ${this.actor.name}`);
    const choices = CONFIG.OSE.monster_saves;
    const content = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/monster-saves.html`,
      { choices }
    );
    new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("OSE.dialog.generateSaves") },
      position: { width: 250 },
      content,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("OSE.Ok"),
          icon: "fas fa-check",
          default: true,
          callback: (event, button) => {
            const { hd } = new foundry.applications.ux.FormDataExtended(button.form).object;
            this.actor.generateSave(hd.replace(/[^\d+.-]/g, ""));
          }
        },
        { action: "cancel", icon: "fas fa-times", label: game.i18n.localize("OSE.Cancel") }
      ]
    }).render(true);
  }

  /**
   * Handle drops of RollTables onto the sheet.
   */
  async _onDrop(event) {
    logger.debug(`Drop event on monster sheet for ${this.actor.name}`);
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return super._onDrop(event); }
    if (data.type !== "RollTable") return super._onDrop(event);

    const link = data.pack
      ? `@UUID[${data.uuid}]{${game.packs.get(data.pack).index.find(e => e._id === data.id).name}}`
      : `@UUID[${data.uuid}]`;

    this.actor.update({ "system.details.treasure.table": link });
  }

  async _resetAttacks(event) {
    logger.info(`Resetting attacks for ${this.actor.name}`);
    const updates = this.actor.items
      .filter(i => i.type === "weapon" && i.system.counter)
      .map(w => ({ _id: w.id, "system.counter.value": w.system.counter.max }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  async _updateAttackCounter(event) {
    event.preventDefault();
    logger.debug(`Updating attack counter for ${this.actor.name}`);
    const item = this._getItemFromActor(event);
    const field = event.target.dataset.field;
    if (item && ["value","max"].includes(field)) {
      await item.update({ [`system.counter.${field}`]: parseInt(event.target.value) });
    }
  }

  _cycleAttackPatterns(event) {
    const item = this._getItemFromActor(event);
    if (!item) return;
    const colors = [...Object.keys(CONFIG.OSE.colors), "transparent"];
    let idx = colors.indexOf(item.system.pattern);
    idx = (idx + 1) % colors.length;
    item.update({ "system.pattern": colors[idx] });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".morale-check a").click(e => this.actor.rollMorale({ event: e }));
    html.find(".reaction-check a").click(e => this.actor.rollReaction({ event: e }));
    html.find(".appearing-check a").click(e => {
      const check = e.currentTarget.closest(".check-field").dataset.check;
      this.actor.rollAppearing({ event: e, check });
    });
    if (!this.options.editable) return;
    html.find(".treasure-table a").contextmenu(e => this.actor.update({ "system.details.treasure.table": "" }));
    html.find(".item-reset[data-action='reset-attacks']").click(this._resetAttacks.bind(this));
    html.find(".counter input").click(e => e.target.select()).change(this._updateAttackCounter.bind(this));
    html.find(".hp-roll").click(e => this.actor.rollHP({ event: e }));
    html.find(".item-pattern").click(this._cycleAttackPatterns.bind(this));
    html.find('button[data-action="generate-saves"]').click(this.generateSave.bind(this));
  }
}