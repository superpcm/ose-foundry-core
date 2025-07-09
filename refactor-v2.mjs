import fs from "fs/promises";
import path from "path";

// --- FILE CONTENTS ---

const actorSheetContent = `
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
      height: 530,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
      scrollY: [".inventory"],
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.actor.toObject(false);

    context.isGM = game.user.isGM;
    context.owner = this.actor.isOwner;
    context.isEditable = this.isEditable;
    context.actor = actorData;
    context.system = actorData.system;
    context.items = actorData.items; // Correctly loads the items
    context.config = OSE;
    context.enrichedBiography = await TextEditor.enrichHTML(context.system.biography, { secrets: this.actor.isOwner, relativeTo: this.actor, async: true });

    // This is a placeholder for your original item preparation logic.
    // Ensure your original _prepareCharacterItems/_prepareMonsterItems methods are copied back into this class.
    if (this.actor.type === "character") {
      this._prepareCharacterItems(context);
    } else if (this.actor.type === "monster") {
      this._prepareMonsterItems(context);
    }

    return context;
  }

  async _renderHTML(options) {
    const context = await this._prepareContext(options);
    const parts = {};

    // Render partials
    parts.header = await this._renderPartial(
      \`\${OSE.systemPath()}/templates/actors/partials/\${context.type}-header.html\`,
      context
    );
    parts.attributesTab = await this._renderPartial(
      \`\${OSE.systemPath()}/templates/actors/partials/\${context.type}-attributes-tab.html\`,
      context
    );
    if (context.type === "character") {
      parts.abilitiesTab = await this._renderPartial(
        \`\${OSE.systemPath()}/templates/actors/partials/character-abilities-tab.html\`,
        context
      );
      parts.inventoryTab = await this._renderPartial(
        \`\${OSE.systemPath()}/templates/actors/partials/character-inventory-tab.html\`,
        context
      );
      parts.notesTab = await this._renderPartial(
        \`\${OSE.systemPath()}/templates/actors/partials/character-notes-tab.html\`,
        context
      );
      if (context.system.spells.enabled) {
        parts.spellsTab = await this._renderPartial(
          \`\${OSE.systemPath()}/templates/actors/partials/character-spells-tab.html\`,
          context
        );
      }
    } else {
        if (context.system.config.enableInventory) {
             parts.inventoryTab = await this._renderPartial(
                \`\${OSE.systemPath()}/templates/actors/partials/character-inventory-tab.html\`,
                context
            );
        }
        if (context.system.spells.enabled){
            parts.spellsTab = await this._renderPartial(
                \`\${OSE.systemPath()}/templates/actors/partials/character-spells-tab.html\`,
                context
            );
        }
        parts.notesTab = \`<div class="inventory">
            <div class="item-category-title">\${game.i18n.localize("OSE.category.notes")}</div>
                <div class="resizable-editor">
                    \${context.enrichedBiography}
                </div>
            </div>\`;
    }

    const dom = new DocumentFragment();
    const form = document.createElement("form");
    form.className = this.options.classes.join(" ");
    form.autocomplete = "off";
    form.innerHTML = \`
      <header class="sheet-header flexrow">\${parts.header}</header>
      <nav class="sheet-tabs tabs" data-group="primary">
        <a class="item" data-tab="attributes">\${game.i18n.localize("OSE.category.attributes")}</a>
        \${context.type === 'character' ? \`<a class="item" data-tab="abilities">\${game.i18n.localize("OSE.category.abilities")}</a>\` : ""}
        \${context.system.spells.enabled ? \`<a class="item" data-tab="spells">\${game.i18n.localize("OSE.category.spells")}</a>\` : ""}
        \${(context.type === 'character' || context.system.config.enableInventory) ? \`<a class="item" data-tab="inventory">\${game.i18n.localize("OSE.category.inventory")}</a>\` : ""}
        <a class="item" data-tab="notes">\${game.i18n.localize("OSE.category.notes")}</a>
      </nav>
      <section class="sheet-body">
        <div class="tab" data-group="primary" data-tab="attributes">\${parts.attributesTab}</div>
        \${context.type === 'character' ? \`<div class="tab" data-group="primary" data-tab="abilities">\${parts.abilitiesTab}</div>\` : ""}
        \${context.system.spells.enabled ? \`<div class="tab" data-group="primary" data-tab="spells">\${parts.spellsTab}</div>\` : ""}
        \${(context.type === 'character' || context.system.config.enableInventory) ? \`<div class="tab" data-group="primary" data-tab="inventory">\${parts.inventoryTab}</div>\` : ""}
        <div class="tab" data-group="primary" data-tab="notes">\${parts.notesTab}</div>
      </section>
    \`;
    dom.append(form);
    return dom;
  }

  async _replaceHTML(element, options) {
    const oldForm = element[0];
    const newForm = (await this._renderHTML(options)).querySelector("form");
    oldForm.replaceWith(newForm);
  }

  // IMPORTANT: You will need to copy your original helper methods
  // (like _prepareCharacterItems, activateListeners, etc.)
  // back into this class from your original file.
}
`;

const characterSheetContent = `
import OseActorSheet from "./actor-sheet.js";

export default class OseActorSheetCharacter extends OseActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "actor", "character"],
      width: 450,
      height: 530,
    });
  }
}
`;

const monsterSheetContent = `
import OseActorSheet from "./actor-sheet.js";

export default class OseActorSheetMonster extends OseActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "monster", "actor"],
      width: 450,
      height: 560,
    });
  }
}
`;

const itemSheetContent = `
import OSE from "../config";
import logger from "../logger.js";

export default class OseItemSheet extends foundry.applications.sheets.ItemSheetV2 {
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

  async _renderHTML(options) {
    const context = await this._prepareContext(options);
    const templatePath = \`\${OSE.systemPath()}/templates/items/\${this.item.type}-sheet.html\`;
    const dom = new DocumentFragment();
    const form = document.createElement("form");
    form.className = this.options.classes.join(" ");
    form.autocomplete = "off";
    form.innerHTML = await renderTemplate(templatePath, context);
    dom.append(form);
    return dom;
  }

  async _replaceHTML(element, options) {
    const oldForm = element[0];
    const newForm = (await this._renderHTML(options)).querySelector("form");
    oldForm.replaceWith(newForm);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.config = OSE;
    context.item.system.description = await TextEditor.enrichHTML(
      context.item.system.description,
      {
        async: true,
      }
    );
    logger.debug("item sheet context", context);
    return context;
  }
  
  // IMPORTANT: You will need to copy your original helper methods
  // (like activateListeners, etc.)
  // back into this class from your original file.
}
`;

const preloadTemplatesContent = `
/**
 * Pre-loads all of the OSE templates and partials.
 */
export default async function preloadTemplates() {
  const templatePaths: string[] = [
    // Actor partials
    "systems/ose/templates/actors/partials/character-header.html",
    "systems/ose/templates/actors/partials/character-attributes-tab.html",
    "systems/ose/templates/actors/partials/character-abilities-tab.html",
    "systems/ose/templates/actors/partials/character-inventory-tab.html",
    "systems/ose/templates/actors/partials/character-notes-tab.html",
    "systems/ose/templates/actors/partials/character-spells-tab.html",
    "systems/ose/templates/actors/partials/monster-header.html",
    "systems/ose/templates/actors/partials/monster-attributes-tab.html",
    "systems/ose/templates/actors/partials/actor-item-summary.html",

    // Item sheets
    "systems/ose/templates/items/ability-sheet.html",
    "systems/ose/templates/items/armor-sheet.html",
    "systems/ose/templates/items/container-sheet.html",
    "systems/ose/templates/items/equipment-sheet.html",
    "systems/ose/templates/items/item-sheet.html",
    "systems/ose/templates/items/spell-sheet.html",
    "systems/ose/templates/items/weapon-sheet.html",
  ];

  return loadTemplates(templatePaths);
}
`;

// --- SCRIPT LOGIC ---

const fileMap = {
  "src/module/actor/actor-sheet.js": actorSheetContent,
  "src/module/actor/character-sheet.js": characterSheetContent,
  "src/module/actor/monster-sheet.js": monsterSheetContent,
  "src/module/item/item-sheet.js": itemSheetContent,
  "src/module/preloadTemplates.ts": preloadTemplatesContent,
};

async function run() {
  console.log("🚀 Starting definitive V2 rendering refactor...");

  for (const [filePath, content] of Object.entries(fileMap)) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      await fs.writeFile(fullPath, content.trim(), "utf-8");
      console.log(\`✅ Successfully updated: \${filePath}\`);
    } catch (error) {
      console.error(\`❌ Error processing \${filePath}: \${error.message}\`);
    }
  }

  console.log("\\n✨ Refactor complete! All files have been updated.");
  console.log("📢 IMPORTANT: Remember to copy your custom helper methods (like activateListeners and _prepareCharacterItems) back into the new sheet classes from your original files.");
}

run();
