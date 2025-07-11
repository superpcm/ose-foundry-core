/**
 * @file The base class we use for Character and Monster sheets. Shared behavior goes here!
 */
import OSE from "../config";
import logger from "../logger.js";
import OseEntityTweaks from "../dialog/entity-tweaks";
import skipRollDialogCheck from "../helpers-behaviour";

export default class OseActorSheet extends foundry.applications.sheets.ActorSheetV2 {
  _expanded = new Set();

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "actor"],
      width: 450,
      height: 560,
      resizable: true,
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Add the actor's derived data model and essential properties.
    foundry.utils.mergeObject(context, {
      actor: this.actor,
      system: this.actor.system, // This is the derived data model
      items: this.actor.items.map(i => i.toObject(true)),
      isGM: game.user.isGM,
      isOwner: this.actor.isOwner,
      isEditable: this.isEditable,
      isNew: this.actor.isNew(),
      config: {
        ...CONFIG.OSE,
        ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
        initiative: game.settings.get(game.system.id, "initiative") !== "group",
        encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
        encumbranceStrengthMod:
          game.settings.get(game.system.id, "encumbranceItemStrengthMod") &&
          game.settings.get(game.system.id, "encumbranceOption") === "itembased",
      }
    });

    for (const i of context.items) {
      i.isExpanded = this._expanded.has(i.id);
    }
    
    // Allow subclasses to prepare their specific data.
    this._prepareSheetData(context);

    logger.debug(`Final context for ${this.actor.name}:`, context);
    return context;
  }

  /**
   * A placeholder method for data preparation that is overridden by subclasses.
   * @param {object} context    The context object to be enriched.
   * @protected
   */
  _prepareSheetData(context) {
    // This method is intended to be overridden by character-sheet.js and monster-sheet.js
  }

  async _renderHTML(options) {
    const context = await this._prepareContext(options);
    // Pre-render sheet header
    context.header = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/${this.actor.type}-header.html`,
      context
    );
    // Pre-render attributes tab
    context.attributesTab = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/${this.actor.type}-attributes-tab.html`,
      context
    );
    // Character-specific tabs
    if (this.actor.type === "character") {
      context.abilitiesTab = await foundry.applications.handlebars.renderTemplate(
        `${OSE.systemPath()}/templates/actors/partials/character-abilities-tab.html`,
        context
      );
      if (context.config.spells.enabled) {
        context.spellsTab = await foundry.applications.handlebars.renderTemplate(
          `${OSE.systemPath()}/templates/actors/partials/character-spells-tab.html`,
          context
        );
      }
      context.inventoryTab = await foundry.applications.handlebars.renderTemplate(
        `${OSE.systemPath()}/templates/actors/partials/character-inventory-tab.html`,
        context
      );
      context.notesTab = await foundry.applications.handlebars.renderTemplate(
        `${OSE.systemPath()}/templates/actors/partials/character-notes-tab.html`,
        context
      );
    }
    // Monster-specific tabs
    else {
      if (context.config.spells.enabled) {
        context.spellsTab = await foundry.applications.handlebars.renderTemplate(
          `${OSE.systemPath()}/templates/actors/partials/monster-spells-tab.html`,
          context
        );
      }
      if (context.config.enableInventory) {
        context.inventoryTab = await foundry.applications.handlebars.renderTemplate(
          `${OSE.systemPath()}/templates/actors/partials/character-inventory-tab.html`,
          context
        );
      }
      // Use enrichedBiography for notes
      context.notesTab = `<div class="inventory">
        <div class="item-category-title">${game.i18n.localize("OSE.category.notes")}</div>
        <div class="resizable-editor">${context.enrichedBiography}</div>
      </div>`;
    }
    // Render the overall sheet template with all parts
    const html = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/actor-sheet.html`,
      context
    );
    return document.createRange().createContextualFragment(html);
  }
  
  async _replaceHTML(element, options) {
    const content = await this._renderHTML(options);
    this.element.replaceChildren(content);
  }
  
  activateEditor(name, options, initialContent) {
    super.activateEditor(name, options, initialContent);
  }

  _getItemFromActor(event) {
    const li = event.currentTarget.closest(".item-entry");
    return this.actor.items.get(li.dataset.itemId);
  }

  _toggleItemCategory(event) {
    event.preventDefault();
    const targetCategory = $(event.currentTarget);
    const items = targetCategory.next(".item-list");

    if (items.css("display") === "none") {
      const el = $(event.currentTarget).find(".fas.fa-caret-right");
      el.removeClass("fa-caret-right").addClass("fa-caret-down");
      items.slideDown(200);
    } else {
      const el = $(event.currentTarget).find(".fas.fa-caret-down");
      el.removeClass("fa-caret-down").addClass("fa-caret-right");
      items.slideUp(200);
    }
  }

  _toggleContainedItems(event) {
    event.preventDefault();
    const targetItems = $(event.target.closest(".container"));
    const items = targetItems.find(".item-list.contained-items");

    if (items.css("display") === "none") {
      const el = targetItems.find(".fas.fa-caret-right");
      el.removeClass("fa-caret-right").addClass("fa-caret-down");
      items.slideDown(200);
    } else {
      const el = targetItems.find(".fas.fa-caret-down");
      el.removeClass("fa-caret-down").addClass("fa-caret-right");
      items.slideUp(200);
    }
  }

  _toggleItemSummary(event) {
    event.preventDefault();
    const item = event.currentTarget.closest(".item-entry.item");
    if (!item) return;
    const itemSummary = item.querySelector(".item-summary");
    if (itemSummary.classList.contains("expanded")) {
      this._expanded.delete(item.dataset.itemId);
    } else {
      this._expanded.add(item.dataset.itemId);
    }
    this.render();
  }

  async _displayItemInChat(event) {
    const item = this._getItemFromActor(event);
    item?.show();
  }

  async _removeItemFromActor(item) {
    if (!item) return;
    if (item.type === "ability" || item.type === "spell") {
      return item.delete();
    }
    if (item.type !== "container" && item.system.containerId) {
      const container = this.actor.items.get(item.system.containerId);
      if (container) {
        const newItemIds = container.system.itemIds.filter((id) => id !== item.id);
        await container.update({ "system.itemIds": newItemIds });
      }
    }
    if (item.type === "container" && item.system.itemIds?.length) {
      const updates = item.system.itemIds.map(id => ({ _id: id, "system.containerId": "" }));
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
    return item.delete();
  }

  _useConsumable(event, decrement) {
    const item = this._getItemFromActor(event);
    if (!item) return;
    let { value: quantity } = item.system.quantity;
    item.update({ "system.quantity.value": decrement ? --quantity : ++quantity });
  }

  async _onSpellChange(event) {
    event.preventDefault();
    const item = this._getItemFromActor(event);
    const field = event.target.dataset.field;
    if (item && ["cast", "memorized"].includes(field)) {
      await item.update({ [`system.${field}`]: parseInt(event.target.value) });
    }
  }

  async _resetSpells(event) {
    const spellsContainer = event.currentTarget.closest(".inventory.spells");
    const spellElements = spellsContainer.querySelectorAll(".item-entry[data-item-id]");
    const updates = [];
    for (const el of spellElements) {
      const item = this.actor.items.get(el.dataset.itemId);
      if (item?.system.memorized !== undefined) {
        updates.push({ _id: item.id, "system.cast": item.system.memorized });
      }
    }
    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
  }

  async _rollAbility(event) {
    const item = this._getItemFromActor(event);
    if (!item) return;
    if (item.type === "weapon") {
      if (this.actor.type === "monster") {
        await item.update({ "system.counter.value": item.system.counter.value - 1 });
      }
      item.rollWeapon({ skipDialog: skipRollDialogCheck(event) });
    } else if (item.type === "spell") {
      await item.spendSpell({ skipDialog: skipRollDialogCheck(event) });
    } else {
      await item.rollFormula({ skipDialog: skipRollDialogCheck(event) });
    }
  }

  async _rollSave(event) {
    const { save } = event.currentTarget.closest("[data-save]").dataset;
    this.actor.rollSave(save, { event });
  }

  async _rollAttack(event) {
    const { attack } = event.currentTarget.closest("[data-attack]").dataset;
    this.actor.targetAttack({ roll: {} }, attack, { type: attack, skipDialog: skipRollDialogCheck(event) });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".saving-throw .attribute-name a").click(this._rollSave.bind(this));
    html.find(".attack a").click(this._rollAttack.bind(this));
    html.find(".hit-dice .attribute-name").click((event) => this.actor.rollHitDice({ event }));
    html.find(".item-rollable .item-image").click(this._rollAbility.bind(this));
    html.find(".inventory .item-category-title").click(this._toggleItemCategory.bind(this));
    html.find(".inventory .item-category-title input").click((event) => event.stopPropagation());
    html.find(".inventory .category-caret").click(this._toggleContainedItems.bind(this));
    html.find(".item-name").click(this._toggleItemSummary.bind(this));
    html.find(".item-controls .item-show").click(this._displayItemInChat.bind(this));

    if (!this.options.editable) return;

    html.find(".item-create").click(this._createItem.bind(this));
    html.find(".item-edit").click((event) => this._getItemFromActor(event)?.sheet.render(true));
    html.find(".item-delete").click((event) => {
      const item = this._getItemFromActor(event);
      if (item?.type !== "container" || !item?.system?.itemIds?.length) {
        return this._removeItemFromActor(item);
      }
      new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize("OSE.dialog.deleteContainer") },
        content: `<p>${game.i18n.localize("OSE.dialog.confirmDeleteContainer")}</p>`,
        buttons: [
          { action: "yes", label: game.i18n.localize("CONFIRM.Yes"), callback: () => this._removeItemFromActor(item) },
          { action: "no", label: game.i18n.localize("CONFIRM.No"), default: true },
        ],
      }).render(true);
    });
    html.find(".quantity input").click((ev) => ev.target.select()).change(this._updateItemQuantity.bind(this));
    html.find(".consumable-counter .full-mark").click((event) => this._useConsumable(event, true));
    html.find(".consumable-counter .empty-mark").click((event) => this._useConsumable(event, false));
    html.find(".memorize input").click((event) => event.target.select()).change(this._onSpellChange.bind(this));
    html.find(".spells .item-reset[data-action='reset-spells']").click(this._resetSpells.bind(this));
  }
}
