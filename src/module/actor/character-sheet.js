/**
 * @file Extend the basic ActorSheet with some very simple modifications
 */
import logger from "../logger.js";
import OSE from "../config";
import OseCharacterCreator from "../dialog/character-creation";
import OseCharacterGpCost from "../dialog/character-gp-cost";
import OseCharacterModifiers from "../dialog/character-modifiers";
import OseActorSheet from "./actor-sheet";

export default class OseActorSheetCharacter extends OseActorSheet {
  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {object} The default options for this sheet.
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "actor", "character"],
      width: 450,
      height: 530,
      resizable: true,
    });
  }

  /**
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async _prepareContext(options) {
    logger.debug(`Preparing character context for ${this.actor.name}`);
    const context = await super._prepareContext(options);

    // Add class list for dropdown.
    context.config.classes = {
      "assassin": "Assassin", "barbarian": "Barbarian", "bard": "Bard", "beast-master": "Beast Master",
      "cleric": "Cleric", "druid": "Druid", "dwarf": "Dwarf", "elf": "Elf", "fighter": "Fighter",
      "gnome": "Gnome", "half-elf": "Half-Elf", "half-orc": "Half-Orc", "hobbit": "Hobbit",
      "illusionist": "Illusionist", "knight": "Knight", "mage": "Mage", "magic-user": "Magic-User",
      "paladin": "Paladin", "ranger": "Ranger", "thief": "Thief", "warden": "Warden"
    };

    context.config.alignments = {
      "lawful": "OSE.alignment.lawful", "neutral": "OSE.alignment.neutral", "chaotic": "OSE.alignment.chaotic"
    };

    context.config.levels = Array.from({length: 15}, (_, i) => i);
    context.config.scores = Array.from({length: 16}, (_, i) => i + 3);

    // CORRECTED: Use context.system instead of this.object.system
    context.enrichedBiography =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        context.system.details.biography || "",
        { async: true, relativeTo: this.actor }
      );
    context.enrichedNotes =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        context.system.details.notes || "",
        { async: true, relativeTo: this.actor }
      );

    return context;
  }

  generateScores(ev) {
    logger.info(`Generating scores for ${this.actor.name}`);
    this.actor.generateScores();
  }

  async _chooseLang() {
    logger.debug("Choosing language");
    const choices = CONFIG.OSE.languages;
    const templateData = { choices };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/lang-create.html`,
      templateData
    );
    return new Promise((resolve) => {
      new foundry.applications.api.DialogV2({
        window: { title: "" },
        content: dlg,
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize("OSE.Ok"),
            icon: "fas fa-check",
            default: true,
            callback: (event, button, html) => {
              resolve(new foundry.applications.ux.FormDataExtended(button.form).object);
            },
          },
          {
            action: "cancel",
            icon: "fas fa-times",
            label: game.i18n.localize("OSE.Cancel"),
            callback: () => {},
          },
        ],
      }).render(true);
    });
  }

  _pushLang(table) {
    const data = this.actor.system;
    logger.info(`Adding language to ${this.actor.name}`);
    this._chooseLang().then((dialogInput) => {
      if (!dialogInput?.choice) return;
      const name = CONFIG.OSE.languages[dialogInput.choice];
      const currentLangs = data[table]?.value || [];
      const updatedLangs = [...currentLangs, name];
      const newData = {};
      newData[table] = { value: updatedLangs };
      return this.actor.update({ system: newData });
    });
  }

  _popLang(table, lang) {
    const data = this.actor.system;
    logger.info(`Removing language ${lang} from ${this.actor.name}`);
    const currentLangs = data[table]?.value || [];
    if (currentLangs.length === 0) return;
    const updatedLangs = currentLangs.filter((el) => el != lang);
    const newData = {};
    newData[table] = { value: updatedLangs };
    return this.actor.update({ system: newData });
  }

  _onShowModifiers(event) {
    event.preventDefault();
    logger.debug(`Showing modifiers for ${this.actor.name}`);
    new OseCharacterModifiers(this.actor, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    }).render(true);
  }

  async _onShowGpCost(event, preparedData) {
    event.preventDefault();
    logger.debug(`Showing GP cost for ${this.actor.name}`);
    new OseCharacterGpCost(this.actor, preparedData, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    }).render(true);
  }

  async _onShowItemTooltip(event) {
    const templateData = {};
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/character-item-tooltip.html`,
      templateData
    );
    document.querySelector(".game").append(dlg);
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".ability-score .attribute-name a").click((ev) => {
      const actorObject = this.actor;
      const element = ev.currentTarget;
      const { score, stat } = element.parentElement.parentElement.dataset;
      if (score) {
        actorObject.rollCheck(score, { event: ev });
      } else if (stat === "lr") {
        actorObject.rollLoyalty(score, { event: ev });
      }
    });
    html.find(".exploration .attribute-name a").click((ev) => {
      const actorObject = this.actor;
      const element = ev.currentTarget;
      const expl = element.parentElement.parentElement.dataset.exploration;
      actorObject.rollExploration(expl, { event: ev });
    });
    html.find(".thiefskills .attribute-name a").click((ev) => {
      const actorObject = this.actor;
      const element = ev.currentTarget;
      const { skill } = element.closest(".attribute").dataset;
      actorObject.rollThiefSkill(skill, { event: ev });
    });
    html.find("a[data-action='modifiers']").click((ev) => { this._onShowModifiers(ev); });
    html.find("a[data-action='gp-cost']").click((ev) => { this._onShowGpCost(ev, this.context); });
    if (!this.options.editable) return;
    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });
    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(table, $(ev.currentTarget).closest(".item").data("lang"));
    });
    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({ system: { equipped: !item.system.equipped } });
    });
    html.find("a[data-action='generate-scores']").click((ev) => { this.generateScores(ev); });
  }
}
