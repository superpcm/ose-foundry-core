/**
 * @file The base class we use for Character and Monster sheets. Shared behavior goes here!
 */
import OSE from "../config";
import logger from "../logger.js";
import OseEntityTweaks from "../dialog/entity-tweaks";
import skipRollDialogCheck from "../helpers-behaviour";

export default class OseActorSheet extends foundry.applications.sheets.ActorSheetV2 {
  /**
   * IDs for items on the sheet that have been expanded.
   * @type {Set<string>}
   * @protected
   */
  _expanded = new Set();

  async _prepareContext(options) {
    logger.debug(`Preparing context for ${this.actor.name}`, { options });
    const context = await super._prepareContext(options);

    // V2 migration: The context's `system` property is the source data, not the derived data model.
    // We need to replace it with the derived data model so that getters are available in the template.
    context.system = this.actor.system;

    for (const i of context.items) {
      i.isExpanded = this._expanded.has(i.id);
    }

    context.config = {
      ...CONFIG.OSE,
      ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
      initiative: game.settings.get(game.system.id, "initiative") !== "group",
      encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
      encumbranceStrengthMod:
        game.settings.get(game.system.id, "encumbranceItemStrengthMod") &&
        game.settings.get(game.system.id, "encumbranceOption") === "itembased",
    };
    context.isNew = this.actor.isNew();

    logger.debug(`Context for ${this.actor.name}:`, context);
    return context;
  }

  activateEditor(name, options, initialContent) {
    // remove some controls to the editor as the space is lacking
    // if (name === "data.details.description") {
    //   options.toolbar = "styleselect bullist hr table removeFormat save";
    // }
    super.activateEditor(name, options, initialContent);
  }

  // Helpers

  _getItemFromActor(event) {
    const li = event.currentTarget.closest(".item-entry");
    return this.actor.items.get(li.dataset.itemId);
  }

  // end Helpers

  _toggleItemCategory(event) {
    event.preventDefault();
    const targetCategory = $(event.currentTarget);
    const items = targetCategory.next(".item-list");

    if (items.css("display") === "none") {
      const el = $(event.currentTarget).find(".fas.fa-caret-right");
      el.removeClass("fa-caret-right");
      el.addClass("fa-caret-down");

      items.slideDown(200);
    } else {
      const el = $(event.currentTarget).find(".fas.fa-caret-down");
      el.removeClass("fa-caret-down");
      el.addClass("fa-caret-right");

      items.slideUp(200);
    }
  }

  _toggleContainedItems(event) {
    event.preventDefault();
    const targetItems = $(event.target.closest(".container"));
    const items = targetItems.find(".item-list.contained-items");

    if (items.css("display") === "none") {
      const el = targetItems.find(".fas.fa-caret-right");
      el.removeClass("fa-caret-right");
      el.addClass("fa-caret-down");

      items.slideDown(200);
    } else {
      const el = targetItems.find(".fas.fa-caret-down");
      el.removeClass("fa-caret-down");
      el.addClass("fa-caret-right");

      items.slideUp(200);
    }
  }

  _toggleItemSummary(event) {
    event.preventDefault();
    const item = event.currentTarget.closest(".item-entry.item");
    const itemSummary = item.querySelector(".item-summary");
    if (itemSummary.classList.contains("expanded")) {
      this._expanded.delete(item.dataset.itemId);
    } else {
      this._expanded.add(item.dataset.itemId);
    }
    itemSummary.classList.toggle("expanded");
  }

  async _displayItemInChat(event) {
    const li = $(event.currentTarget).closest(".item-entry");
    logger.info(`Displaying item in chat for actor ${this.actor.name}`, { item: li.data("itemId") });
    const item = this.actor.items.get(li.data("itemId"));
    item.show();
  }

  // eslint-disable-next-line no-underscore-dangle, consistent-return
  async _removeItemFromActor(item) {
    if (item.type === "ability" || item.type === "spell") {
      logger.info(`Deleting ability/spell ${item.name} from ${this.actor.name}`);
      // eslint-disable-next-line no-underscore-dangle
      return this.actor.deleteEmbeddedDocuments("Item", [item._id]);
    }
    if (item.type !== "container" && item.system.containerId !== "") {
      const { containerId } = item.system;
      const newItemIds = this.actor.items
        .get(containerId)
        .system.itemIds.filter((o) => o !== item.id);
      logger.info(`Removing item ${item.name} from container ${containerId}`);

      await this.actor.updateEmbeddedDocuments("Item", [
        { _id: containerId, system: { itemIds: newItemIds } },
      ]);
    }
    if (item.type === "container" && item.system.itemIds) {
      const containedItems = item.system.itemIds;
      logger.info(`Emptying container ${item.name} before deletion`);
      const updateData = containedItems.reduce((acc, val) => {
        // Only create update data for items that still exist on the actor
        if (this.actor.items.get(val))
          acc.push({ _id: val, "system.containerId": "" });
        return acc;
      }, []);

      await this.actor.updateEmbeddedDocuments("Item", updateData);
    }

    logger.info(`Deleting item ${item.name} from ${this.actor.name}`);
    // eslint-disable-next-line no-underscore-dangle
    this.actor.deleteEmbeddedDocuments("Item", [item._id]);
  }

  /**
   * @param event
   * @param {bool} decrement
   */
  _useConsumable(event, decrement) {
    const item = this._getItemFromActor(event);
    logger.info(`Using consumable ${item?.name} for ${this.actor.name}`);
    if (!item) return null;
    let {
      quantity: { value: quantity },
    } = item.system;
    item.update({
      "system.quantity.value": decrement ? --quantity : ++quantity,
    });
  }

  async _onSpellChange(event) {
    event.preventDefault();
    const item = this._getItemFromActor(event);
    logger.info(`Changing spell ${item?.name} for ${this.actor.name}`);
    if (event.target.dataset.field === "cast") {
      return item.update({ "system.cast": parseInt(event.target.value) });
    }
    if (event.target.dataset.field === "memorize") {
      return item.update({
        "system.memorized": parseInt(event.target.value),
      });
    }
  }

  async _resetSpells(event) {
    const spellsContainer = event.currentTarget.closest(".inventory.spells");
    const spellElements = spellsContainer.querySelectorAll(".item-entry");
    logger.info(`Resetting spells for ${this.actor.name}`);

    const updates = [];
    for (const el of spellElements) {
      const { itemId } = el.dataset;
      const item = this.actor.items.get(itemId);

      if (item?.system) {
        updates.push({
          _id: item.id,
          "system.cast": item.system.memorized,
        });
      }
    }

    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
  }

  async _rollAbility(event) {
    const item = this._getItemFromActor(event);
    const itemData = item?.system;
    logger.info(`Rolling ability/item ${item?.name} for ${this.actor.name}`);
    if (item.type === "weapon") {
      if (this.actor.type === "monster") {
        await item.update({
          "system.counter.value": itemData.counter.value - 1,
        });
      }
      item.rollWeapon({ skipDialog: skipRollDialogCheck(event) });
    } else if (item.type == "spell") {
      await item.spendSpell({ skipDialog: skipRollDialogCheck(event) });
    } else {
      await item.rollFormula({ skipDialog: skipRollDialogCheck(event) });
    }
  }

  async _rollSave(event) {
    const actorObject = this.actor;
    const element = event.currentTarget;
    logger.info(`Rolling save for ${this.actor.name}`, { save: element.parentElement.parentElement.dataset.save });
    const { save } = element.parentElement.parentElement.dataset;
    actorObject.rollSave(save, { event });
  }

  async _rollAttack(event) {
    const actorObject = this.actor;
    const element = event.currentTarget;
    logger.info(`Rolling attack for ${this.actor.name}`, { attack: element.parentElement.parentElement.dataset.attack });
    const { attack } = element.parentElement.parentElement.dataset;
    actorObject.targetAttack({ roll: {} }, attack, {
      type: attack,
      skipDialog: skipRollDialogCheck(event),
    });
  }

  _onSortItem(event, itemData) {
    logger.debug(`Sorting item for ${this.actor.name}`, { itemData });
    const source = this.actor.items.get(itemData.id);
    const siblings = this.actor.items.filter(
      (i) => i.id !== source.id
    );
    const dropTarget = event.target.closest("[data-item-id]");
    const targetId = dropTarget ? dropTarget.dataset.itemId : null;
    const target = siblings.find((s) => s.id === targetId);
    if (!target) {
      logger.warn(`Could not find drop target for sorting near`, event.target);
      return;
    }
    const targetData = target?.system;

    // Dragging items into a container
    if (
      target?.type === "container" &&
      targetData.containerId === ""
    ) {
      this.actor.updateEmbeddedDocuments("Item", [
        { _id: source.id, "system.containerId": target.id },
      ]);
      return;
    }
    if (source?.system.containerId !== "") {
      this.actor.updateEmbeddedDocuments("Item", [
        { _id: source.id, "system.containerId": "" },
      ]);
    }

    super._onSortItem(event, itemData);
  }

  _onDragStart(event) {
    const li = event.currentTarget;
    logger.debug(`Drag start on actor sheet for ${this.actor.name}`, { element: li });
    let itemIdsArray = [];
    if (event.target.classList.contains("content-link")) return;

    let dragData;

    // Owned Items
    if (li.dataset.itemId) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
      dragData.item = item;
      dragData.type = "Item";
      if (item.type === "container" && item.system.itemIds.length > 0) {
        // otherwise JSON.stringify will quadruple stringify for some reason
        itemIdsArray = item.system.itemIds;
      }
    }

    // Create drag data
    dragData.actorId = this.actor.id;
    dragData.sceneId = this.actor.isToken ? canvas.scene?.id : null;
    dragData.tokenId = this.actor.isToken ? this.actor.token.id : null;
    dragData.pack = this.actor.pack;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.actor.effects.get(li.dataset.effectId);
      dragData.type = "ActiveEffect";
      dragData.data = effect.toObject();
    }

    // Set data transfer
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify(dragData, (key, value) => {
        if (key === "itemIds") {
          // something about how this Array is created makes its elements not real Array elements
          // we go through this hoop to trick stringify into creating our string
          return JSON.stringify(itemIdsArray);
        }
        return value;
      })
    );
  }

  // eslint-disable-next-line no-underscore-dangle
  async _onDropFolder(event, data) {
    logger.debug(`Dropping folder on actor sheet for ${this.actor.name}`, { data });
    const folder = await fromUuid(data.uuid);
    if (!folder || folder.type !== "Item") return;

    let itemArray = folder.contents || [];

    folder.getSubfolders(true).forEach((subfolder) => {
      itemArray.push(...subfolder.contents);
    });

    // Compendium items
    if (itemArray.length > 0 && itemArray[0]?.uuid?.includes("Compendium")) {
      const items = [];
      itemArray.forEach(async (item) => {
        items.push(await fromUuid(item.uuid));
      });
      itemArray = items;
    }

    this._onDropItemCreate(itemArray);
  }

  // eslint-disable-next-line no-underscore-dangle
  async _onDropItem(event, data) {
    logger.debug(`Dropping item on actor sheet for ${this.actor.name}`, { data, target: event.target });
    const targetId = event.target.closest(".item")?.dataset?.itemId;
    const targetItem = this.actor.items.get(targetId);
    const targetIsContainer = targetItem?.type === "container";

    // This eats the event.target as it is parsed with the TextEditor.
    const item = await Item.implementation.fromDropData(data);
    const itemData = item.toObject();

    const exists = !!this.actor.items.get(item.id);

    const isContainer = this.actor.items.get(item.system.containerId);

    // Issue: https://github.com/vttred/ose/issues/357
    if (item.id === targetId) return;

    if (!exists && !targetIsContainer)
      // eslint-disable-next-line no-underscore-dangle
      return this._onDropItemCreate([itemData]);

    // eslint-disable-next-line no-underscore-dangle
    if (isContainer) return this._onContainerItemRemove(item, isContainer);

    // eslint-disable-next-line no-underscore-dangle
    if (targetIsContainer) return this._onContainerItemAdd(item, targetItem);
  }

  async _onContainerItemRemove(item, container) {
    logger.info(`Removing item ${item.name} from container ${container.name}`);
    const newList = container.system.itemIds.filter((s) => s != item.id);
    const itemObj = this.object.items.get(item.id);
    await container.update({ system: { itemIds: newList } });
    await itemObj.update({ system: { containerId: "" } });
  }

  async _onContainerItemAdd(item, target) {
    logger.info(`Adding item ${item.name} to container ${target.name}`);
    const alreadyExistsInActor = target.parent.items.find(
      (i) => i.id === item.id
    );
    let latestItem = item;
    if (!alreadyExistsInActor) {
      // eslint-disable-next-line no-underscore-dangle
      const newItem = await this._onDropItemCreate([item.toObject()]);
      latestItem = newItem.pop();
    }

    const alreadyExistsInContainer = target.system.itemIds.find(
      (i) => i.id === latestItem.id
    );
    if (!alreadyExistsInContainer) {
      const newList = [...target.system.itemIds, latestItem.id];
      await target.update({ system: { itemIds: newList } });
      await latestItem.update({ system: { containerId: target.id } });
    }
  }

  // eslint-disable-next-line no-underscore-dangle, consistent-return
  async _onDropItemCreate(droppedItemData, targetContainer = false) {
    logger.info(`Creating dropped item(s) on ${this.actor.name}`, { droppedItemData, targetContainer });

    const itemsToCreate = [];
    const itemsToProcess = Array.isArray(droppedItemData) ? [...droppedItemData] : [droppedItemData];

    // Use a while loop to safely process items from a queue, avoiding array modification during iteration.
    while (itemsToProcess.length > 0) {
      const itemData = itemsToProcess.shift();

      // Ensure containerId is cleared so it doesn't think it belongs to a non-existent container.
      if (itemData.system) {
        itemData.system.containerId = "";
      }

      // If the item is a container with contents, unpack them.
      if (itemData.type === "container" && itemData.system?.itemIds) {
        let containedItemsData;
        // Safely parse the contained items. It might be a stringified JSON array.
        if (typeof itemData.system.itemIds === "string") {
          try {
            containedItemsData = JSON.parse(itemData.system.itemIds);
          } catch (e) {
            logger.warn(`Could not parse contained item IDs for container ${itemData.name}`, e);
            containedItemsData = [];
          }
        } else if (Array.isArray(itemData.system.itemIds)) {
          containedItemsData = itemData.system.itemIds;
        }

        if (Array.isArray(containedItemsData)) {
          // Add the unpacked items to the front of the processing queue.
          itemsToProcess.unshift(...containedItemsData);
        }

        // Clear the itemIds from the container data itself, as we are creating them as separate items.
        itemData.system.itemIds = [];
      }
      itemsToCreate.push(itemData);
    }

    if (itemsToCreate.length === 0) return [];

    // Now, create all the unpacked items.
    const createdDocuments = await this.actor.createEmbeddedDocuments("Item", itemsToCreate);

    // If there's a target container on the sheet, move the top-level dropped item into it.
    if (targetContainer && createdDocuments.length > 0) {
      const mainDroppedItem = createdDocuments[0];
      const { itemIds } = targetContainer.system;
      itemIds.push(mainDroppedItem.id);
      await targetContainer.update({ system: { itemIds } });
      await mainDroppedItem.update({ system: { containerId: targetContainer.id } });
    }

    return createdDocuments;
  }

  /* -------------------------------------------- */

  async _chooseItemType(choices = ["weapon", "armor", "shield", "gear"]) {
    logger.debug("Choosing item type for creation");
    const templateData = {
      types: choices.reduce((obj, choice) => {
        obj[choice] = choice;
        return obj;
      }, {}),
    };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/items/entity-create.html`,
      templateData
    );
    // Create Dialog window
    return new Promise((resolve) => {
      new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize("OSE.dialog.createItem") },
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

  // eslint-disable-next-line no-underscore-dangle
  _createItem(event) {
    event.preventDefault();
    logger.info(`Creating item for ${this.actor.name}`);
    const header = event.currentTarget;
    const { treasure, type, lvl } = header.dataset;
    const createItem = (type, name) => ({
      name: name || `New ${type.capitalize()}`,
      type,
    });

    // Getting back to main logic
    if (type === "choice") {
      const choices = header.dataset.choices.split(",");
      this._chooseItemType(choices).then((dialogInput) => {
        const itemData = createItem(dialogInput.type, dialogInput.name);
        this.actor.createEmbeddedDocuments("Item", [itemData], {});
      });
    } else {
      const itemData = createItem(type);
      if (treasure) itemData.system = { treasure: true };
      // when creating a new spell on the character sheet, we need to set the level
      if (type === "spell") itemData.system = lvl ? { lvl } : { lvl: 1 };
      return this.actor.createEmbeddedDocuments("Item", [itemData], {});
    }
  }

  async _updateItemQuantity(event) {
    event.preventDefault();
    logger.debug(`Updating item quantity for ${this.actor.name}`);
    const item = this._getItemFromActor(event);

    if (event.target.dataset.field === "value") {
      return item.update({
        "system.quantity.value": parseInt(event.target.value),
      });
    }
    if (event.target.dataset.field === "max") {
      return item.update({
        "system.quantity.max": parseInt(event.target.value),
      });
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  _onConfigureActor(event) {
    event.preventDefault();
    logger.info(`Opening tweaks dialog for ${this.actor.name}`);
    new OseEntityTweaks(this.actor, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    }).render(true);
  }

  async _render(force, options) {
    await super._render(force, options);

    // V13 Compatibility: Manually inject the header button for dynamic visibility.
    const canConfigure = game.user.isGM || this.actor.isOwner;
    if (this.isEditable && canConfigure) {
      const title = this.element.querySelector(".window-title");
      // Prevent adding the button multiple times on re-renders.
      if (title && !this.element.querySelector(".configure-actor")) {
        const button = document.createElement("a");
        button.classList.add("header-button", "configure-actor");
        button.innerHTML = `<i class="fas fa-code"></i> ${game.i18n.localize("OSE.dialog.tweaks")}`;
        button.addEventListener("click", this._onConfigureActor.bind(this));
        title.after(button);
      }
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Attributes
    html.find(".saving-throw .attribute-name a").click((event) => {
      this._rollSave(event);
    });

    html.find(".attack a").click((event) => {
      this._rollAttack(event);
    });

    html.find(".hit-dice .attribute-name").click((event) => {
      this.actor.rollHitDice({ event });
    });

    // Items (Abilities, Inventory and Spells)
    html.find(".item-rollable .item-image").click(async (event) => {
      this._rollAbility(event);
    });

    html.find(".inventory .item-category-title").click((event) => {
      this._toggleItemCategory(event);
    });
    html.find(".inventory .item-category-title input").click((event) => {
      event.stopPropagation();
    });
    html.find(".inventory .category-caret").click((event) => {
      this._toggleContainedItems(event);
    });

    html.find(".item-name").click((event) => {
      this._toggleItemSummary(event);
    });

    html.find(".item-controls .item-show").click(async (event) => {
      this._displayItemInChat(event);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Item Management
    html.find(".item-create").click((event) => {
      // eslint-disable-next-line no-underscore-dangle
      this._createItem(event);
    });

    html.find(".item-edit").click((event) => {
      const item = this._getItemFromActor(event);
      item.sheet.render(true);
    });

    html.find(".item-delete").click((event) => {
      const item = this._getItemFromActor(event);

      if (item?.type !== "container" || !item?.system?.itemIds?.length > 0)
        return this._removeItemFromActor(item);

      new foundry.applications.api.DialogV2({
        window: {
          title: game.i18n.localize("OSE.dialog.deleteContainer"),
        },
        content: `<p>${game.i18n.localize(
          "OSE.dialog.confirmDeleteContainer"
        )}</p>`,
        buttons: [
          {
            action: "yes",
            label: game.i18n.localize("CONFIRM.Yes"),
            callback: () => this._removeItemFromActor(item),
          },
          {
            action: "no",
            label: game.i18n.localize("CONFIRM.No"),
            default: true,
          },
        ],
      });
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change(this._updateItemQuantity.bind(this));

    // Consumables
    html.find(".consumable-counter .full-mark").click((event) => {
      this._useConsumable(event, true);
    });
    html.find(".consumable-counter .empty-mark").click((event) => {
      this._useConsumable(event, false);
    });

    // Spells
    html
      .find(".memorize input")
      .click((event) => event.target.select())
      .change(this._onSpellChange.bind(this));

    html
      .find(".spells .item-reset[data-action='reset-spells']")
      .click((event) => {
        this._resetSpells(event);
      });
  }
}
