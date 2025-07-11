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
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "actor", "character"],
      width: 450,
      height: 530,
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    logger.debug(`Preparing character context for ${this.actor.name}`);

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

    context.config.levels = Array.from({length: 15}, (_, i) => i + 1);
    context.config.scores = Array.from({length: 16}, (_, i) => i + 3);

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.details.biography || "", { async: true, relativeTo: this.actor }
    );
    context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.details.notes || "", { async: true, relativeTo: this.actor }
    );

    return context;
  }

  async _renderHTML(options) {
    const context = await this._prepareContext(options);
    // Render the overall sheet template
    const html = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/actor-sheet.html`,
      context
    );
    // Convert the HTML string into a DocumentFragment and return it
    return document.createRange().createContextualFragment(html);
  }

  async _replaceHTML(element, options) {
    const content = await this._renderHTML(options);
    this.element.replaceChildren(content);
  }

  generateScores(ev) {
    this.actor.generateScores();
  }
  
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".ability-score .attribute-name a").click((ev) => {
      const { score, stat } = ev.currentTarget.closest(".attribute").dataset;
      if (score) this.actor.rollCheck(score, { event: ev });
      else if (stat === "lr") this.actor.rollLoyalty({ event: ev });
    });

    html.find(".exploration .attribute-name a").click((ev) => {
      const expl = ev.currentTarget.closest(".attribute").dataset.exploration;
      this.actor.rollExploration(expl, { event: ev });
    });

    html.find(".thiefskills .attribute-name a").click((ev) => {
      const { skill } = ev.currentTarget.closest(".attribute").dataset;
      this.actor.rollThiefSkill(skill, { event: ev });
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      new OseCharacterModifiers(this.actor, {
        position: { top: this.position.top + 40, left: this.position.left + (this.position.width - 400) / 2 },
      }).render(true);
    });

    html.find("a[data-action='gp-cost']").click((ev) => {
      new OseCharacterGpCost(this.actor, this.context, {
        position: { top: this.position.top + 40, left: this.position.left + (this.position.width - 400) / 2 },
      }).render(true);
    });

    if (!this.options.editable) return;
    
    html.find(".item-toggle").click(async (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ "system.equipped": !item.system.equipped });
    });

    html.find("a[data-action='generate-scores']").click(this.generateScores.bind(this));
  }
}
