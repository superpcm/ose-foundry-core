/**
 * @file The system-level sheet for items of any type
 */
import OSE from "../config";
import logger from "../logger.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 */
export default class OseItemSheet extends foundry.applications.sheets.ItemSheetV2 {
  /**
   * Extend and override the default options used by the Simple Item Sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "item"],
      width: 520,
      height: 390,
      resizable: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = `${OSE.systemPath()}/templates/items`;
    return `${path}/${this.item.type}-sheet.html`;
  }

  /**
   * Prepare data for rendering the Item sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   *
   * @returns {object} Data for the Handlebars template
   */
  async _prepareContext(options) {
    logger.debug(`Preparing context for item ${this.item.name}`);
    const context = await super._prepareContext(options);

    // V2 migration: The context's `system` property is the source data, not the derived data model.
    // We need to replace it with the derived data model so that getters are available in the template.
    context.system = this.item.system;

    context.config = {
      ...CONFIG.OSE,
      encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
    };
    context.enriched = {
      description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.item.system?.description || "",
        { async: true }
      ),
    };
    logger.debug(`Context for ${this.item.name}:`, context);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param {JQuery} html - The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    html.find('input[data-action="add-tag"]').keypress((ev) => {
      if (ev.which === 13) {
        const value = $(ev.currentTarget).val();
        const values = value.split(",");
        logger.info(`Adding manual tag(s) to ${this.object.name}:`, values);
        this.object.pushManualTag(values);
      }
    });
    html.find(".tag-delete").click((ev) => {
      const value = ev.currentTarget.parentElement.dataset.tag;
      logger.info(`Removing manual tag from ${this.object.name}:`, value);
      this.object.popManualTag(value);
    });
    html.find("a.melee-toggle").click(() => {
      logger.info(`Toggling melee for ${this.object.name}`);
      this.object.update({ "system.melee": !this.object.system.melee });
    });

    html.find("a.missile-toggle").click(() => {
      logger.info(`Toggling missile for ${this.object.name}`);
      this.object.update({ "system.missile": !this.object.system.missile });
    });

    super.activateListeners(html);
  }
}
