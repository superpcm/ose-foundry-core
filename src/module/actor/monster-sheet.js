/**
 * @file The sheet class for Actors of type Monster
 */
import OSE from "../config";
import logger from "../logger.js";
import OseActorSheet from "./actor-sheet";

export default class OseActorSheetMonster extends OseActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "monster", "actor"],
      width: 450,
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    logger.debug(`Preparing monster context for ${this.actor.name}`);
    const monsterData = context.system;

    context.config.morale = game.settings.get(game.system.id, "morale");

    if (monsterData.details.treasure?.table) {
      context.treasureLink = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        monsterData.details.treasure.table, { async: true, relativeTo: this.actor }
      );
    }
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      monsterData.details.biography || "", { async: true, relativeTo: this.actor }
    );

    return context;
  }

  async generateSave() {
    const choices = CONFIG.OSE.monster_saves;
    const templateData = { choices };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/monster-saves.html`,
      templateData
    );
    new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("OSE.dialog.generateSaves") },
      position: { width: 250 },
      content: dlg,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("OSE.Ok"),
          icon: "fas fa-check",
          default: true,
          callback: (event, button) => {
            const { hd } = new foundry.applications.ux.FormDataExtended(button.form).object;
            this.actor.generateSave(hd.replace(/[^\d+.-]/g, ""));
          },
        },
        { action: "cancel", icon: "fas fa-times", label: game.i18n.localize("OSE.Cancel") },
      ],
    }).render(true);
  }
  
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".morale-check a").click((ev) => this.actor.rollMorale({ event: ev }));
    html.find(".reaction-check a").click((ev) => this.actor.rollReaction({ event: ev }));
    html.find(".appearing-check a").click((ev) => {
      const check = ev.currentTarget.closest(".check-field").dataset.check;
      this.actor.rollAppearing({ event: ev, check });
    });

    if (!this.options.editable) return;

    html.find(".treasure-table a").contextmenu((ev) => {
      this.actor.update({ "system.details.treasure.table": "" });
    });

    html.find(".item-reset[data-action='reset-attacks']").click(async (ev) => {
      const updates = this.actor.items
        .filter((i) => i.type === "weapon" && i.system.counter)
        .map((weapon) => ({ _id: weapon.id, "system.counter.value": weapon.system.counter.max }));
      if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
    });

    html.find(".counter input").click((ev) => ev.target.select()).change(async (ev) => {
      const item = this._getItemFromActor(ev);
      const field = ev.target.dataset.field;
      if (item && ["value", "max"].includes(field)) {
        await item.update({ [`system.counter.${field}`]: parseInt(ev.target.value) });
      }
    });

    html.find(".hp-roll").click((ev) => this.actor.rollHP({ event: ev }));
    
    html.find(".item-pattern").click((ev) => {
      const item = this._getItemFromActor(ev);
      if (!item) return;
      const colors = Object.keys(CONFIG.OSE.colors);
      colors.push("transparent");
      const currentColor = item.system.pattern || "transparent";
      const nextIndex = (colors.indexOf(currentColor) + 1) % colors.length;
      item.update({ "system.pattern": colors[nextIndex] });
    });

    html.find('button[data-action="generate-saves"]').click(this.generateSave.bind(this));
  }
}
