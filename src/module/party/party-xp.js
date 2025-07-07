/**
 * @file An application for dispensing XP to party members
 */
import OSE from "../config";
import OseParty from "./party";

export default class OsePartyXP extends foundry.applications.api.ApplicationV2 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "dialog", "party-xp"],
      template: `${OSE.systemPath()}/templates/apps/party-xp.html`,
      width: 300,
      height: "auto",
      resizable: false,
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   *
   * @type {string}
   */
  // eslint-disable-next-line class-methods-use-this
  get title() {
    return game.i18n.localize("OSE.dialog.xp.deal");
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   *
   * @returns {object}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actors = OseParty.currentParty;
    context.config = CONFIG.OSE;
    context.user = game.user;
    context.settings = game.settings;
    return context;
  }

  /* -------------------------------------------- */

  // eslint-disable-next-line no-underscore-dangle
  _calculateShare() {
    const { currentParty } = OseParty;

    // Guard against no party members
    if (!currentParty || currentParty.length === 0) {
      return;
    }

    const html = $(this.element);
    const totalXP = parseFloat(html.find('input[name="total"]').val());

    // Guard against non-numeric input
    if (isNaN(totalXP)) {
      return;
    }

    const baseXpShare = parseFloat(totalXP) / currentParty.length;

    currentParty.forEach((a) => {
      const actorData = a?.system;
      const xpShare = Math.floor((actorData.details.xp.share / 100) * baseXpShare);
      html.find(`li[data-actor-id='${a.id}'] input`).val(xpShare);
    });
  }

  // eslint-disable-next-line no-underscore-dangle
  _dealXP() {
    const html = $(this.element);
    const rows = html.find(".actor");
    rows.each((_, row) => {
      const qRow = $(row);
      const value = qRow.find("input").val();
      const id = qRow.data("actorId");
      const actor = OseParty.currentParty.find((e) => e.id === id);
      if (value) {
        actor.getExperience(Math.floor(parseInt(value, 10)));
      }
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    const totalField = html.find('input[name="total"]');
    // eslint-disable-next-line no-underscore-dangle
    totalField.on("input", this._calculateShare.bind(this));

    html.find('button[data-action="deal-xp"]').click((event) => {
      this._dealXP();
      this.close();
    });
  }
}
