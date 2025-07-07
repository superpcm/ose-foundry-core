/**
 * @file An application for deducting currency from an actor using the Shopping Cart feature
 */
// eslint-disable-next-line no-unused-vars
import OSE from "../config";

export default class OseCharacterGpCost extends foundry.applications.api.ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.preparedData = options.preparedData;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes = ["ose", "dialog", "gp-cost"];
    options.id = "sheet-gp-cost";
    options.template = `${OSE.systemPath()}/templates/actors/dialogs/gp-cost-dialog.html`;
    options.width = 240;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   *
   * @type {string}
   * @returns {string} - A localized window title
   */
  get title() {
    return `${this.actor.name}: ${game.i18n.localize(
      "OSE.dialog.shoppingCart"
    )}`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   *
   * @returns {object} - The template data
   */
  async _prepareContext() {
    const data = await foundry.utils.deepClone(this.preparedData);
    data.totalCost = await this.#getTotalCost(data);
    data.user = game.user;
    return data;
  }

  // eslint-disable-next-line class-methods-use-this
  async #getTotalCost(data) {
    let total = 0;
    const physical = new Set(["item", "container", "weapon", "armor"]);
    data.items.forEach((item) => {
      const itemData = item.system;
      if (physical.has(item.type) && !itemData.treasure)
        total += itemData.quantity.max
          ? itemData.cost
          : itemData.cost * itemData.quantity.value;
    });
    return total;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("a.auto-deduct").click(async (ev) => {
      ev.preventDefault();

      // --- Deduct GP ---
      const totalCost = await this.#getTotalCost(await this._prepareContext());
      const gp = this.actor.items.find((item) => {
        const itemData = item.system;
        return (
          (item.name === game.i18n.localize("OSE.items.gp.short") ||
            item.name === "GP") && // legacy behavior used GP, even for other languages
          itemData.treasure
        );
      });

      if (!gp) {
        ui.notifications.error(game.i18n.localize("OSE.error.noGP"));
        return;
      }

      const newGP = gp.system.quantity.value - totalCost;
      if (newGP < 0) {
        ui.notifications.error(game.i18n.localize("OSE.error.notEnoughGP"));
        return;
      }

      await this.actor.updateEmbeddedDocuments("Item", [
        { _id: gp.id, "system.quantity.value": newGP },
      ]);

      // --- Create Chat Message ---
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const templateData = await this._prepareContext();
      const content = await foundry.applications.handlebars.renderTemplate(
        `${OSE.systemPath()}/templates/chat/inventory-list.html`,
        templateData
      );
  }
}
