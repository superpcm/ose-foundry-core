/**
 * @file System-level modifications to the way combat works
 */
import { OSE } from "../config";
import OSECombatGroupSelector from "./combat-set-groups";

export const actionGroups = {
  slow: "OSE.items.Slow",
  cast: "OSE.spells.Cast",
};

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 *
 * @todo Use a single chat card for rolling group initiative
 */
export class OSECombat extends foundry.documents.Combat {
  static FORMULA = "1d6 + @init";

  static GROUP_FORMULA = "1d6";

  static get GROUPS() {
    return {
      ...OSE.colors,
      ...actionGroups,
    };
  }

  get #rerollBehavior() {
    return game.settings.get(game.system.id, "rerollInitiative");
  }

  /**
   * Returns whether the combat is using group initiative.
   *
   * @returns {boolean} True if the combat is using group initiative, false otherwise.
   */
  get isGroupInitiative(): boolean {
    return game.settings.get(game.system.id, "initiative") === "group";
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  /**
   * Roll initiative for all combatants.
   *
   * @param {boolean} excludeAlreadyRolled - If true, exclude combatants that have already rolled initiative.
   * @private
   */
  async #rollAbsolutelyEveryone(excludeAlreadyRolled = false) {
    const formula = this.isGroupInitiative
      ? OSECombat.GROUP_FORMULA
      : OSECombat.FORMULA;

    await this.rollInitiative(
      this.combatants
        .filter(
          (c) => !c.defeated && (!excludeAlreadyRolled || c.initiative === null)
        )
        .map((c) => c.id),
      { formula }
    );
  }

  /**
   * Reroll initiative for all combatants.
   * If the initiative type is set to "group", reroll initiative for each group.
   *
   * @param {boolean} excludeAlreadyRolled - If true, exclude combatants that have already rolled initiative.
   */
  async smartRerollInitiative(excludeAlreadyRolled = false) {
    if (!this.isGroupInitiative) {
      return this.#rollAbsolutelyEveryone(excludeAlreadyRolled);
    }

    const updates = [];
    const messages = [];
    for (const group of this.groups) {
      if (
        group.members.size === 0 ||
        (excludeAlreadyRolled && group.initiative !== null) ||
        group.name === "slow"
      ) {
        continue;
      }

      const roll = new Roll(OSECombat.GROUP_FORMULA);
      await roll.evaluate();
      updates.push({ _id: group.id, initiative: roll.total });

      const rollMode = game.settings.get("core", "rollMode");

      // Construct chat message data
      const messageData = {
        speaker: {
          alias: game.i18n.localize("OSE.Initiative"),
        },
        flavor: game.i18n.format("OSE.roll.initiative", {
          group: foundry.utils.escapeHTML(group.name),
        }),
        flags: { "core.initiativeRoll": true },
      };
      const chatData = await roll.toMessage(messageData, {
        rollMode,
        create: false,
      });
      messages.push(chatData);
    }

    if (updates.length === 0) {
      return;
    }

    await this.updateEmbeddedDocuments("CombatantGroup", updates);
    // Create multiple chat messages
    await foundry.documents.ChatMessage.implementation.create(messages);

    this.setupTurns();
    await ui.combat.render(true);
    return this;
  }

  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  /** @override */
  async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset") await this.smartRerollInitiative(true);
    return this;
  }

  async resetActions() {
    for (const combatant of this.combatants) {
      await combatant.setFlag(game.system.id, "prepareSpell", false);
      await combatant.setFlag(game.system.id, "moveInCombat", false);
    }
  }

  /** @override */
  async _onEndRound(context: CombatRoundEventContext) {
    switch (this.#rerollBehavior) {
      case "reset":
        await this.resetAll();
        break;
      case "reroll":
        await this.smartRerollInitiative();
        break;
      case "keep":
      default:
        break;
    }
    await super._onEndRound(context);
    await this.resetActions();
    await this.activateCombatant(0);
  }

  /** @override */
  async resetAll(args: object) {
    await super.resetAll(args);

    if (this.isGroupInitiative) {
      const groupUpdates = this.groups.map((g: CombatantGroup) => ({
        _id: g.id,
        initiative: null,
      }));

      if (groupUpdates.length > 0) {
        await this.updateEmbeddedDocuments("CombatantGroup", groupUpdates);
        this.setupTurns();
        await ui.combat.render(true);
      }
    }
  }

  /**
   * Activate the given combatant within the combat.
   *
   * @param {number} turn - The turn number of the combatant to activate.
   */
  async activateCombatant(turn: number) {
    if (game.user.isGM) {
      await game.combat.update({ turn });
    }
  }

  /**
   * Determine which group each combatant should be added to, or if a new group should be created.
   *
   * @returns {Map<string, { combatants: OSECombatant[], expanded: boolean }>}
   */
  async createGroups() {
    for (const combatant of this.combatants) {
      if (combatant.group) continue;

      const key = combatant.groupRaw;
      if (!key) continue;

      if (!this.groups.find((g) => g.name === key)) {
        await this.createEmbeddedDocuments("CombatantGroup", [
          { name: key, initiative: null },
        ]);
      }
      const group = this.groups.find((g) => g.name === key);
      if (!group) continue;
      await combatant.update({ group: group.id });
    }

    return this.groups;
  }

  /**
   * Prompts to set the combatant groups.
   */
  setCombatantGroups() {
    new OSECombatGroupSelector().render(true, { focus: true });
  }

  /** @override */
  _sortCombatants(a, b) {
    // First sort by initiative
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    const initiativeDiff = ib - ia;

    if (initiativeDiff !== 0) return initiativeDiff;

    // If still tied, sort by group name if available
    if (a.group?.name && b.group?.name && a.group?.name !== b.group?.name) {
      const colorsKeys = Object.keys(OSECombat.GROUPS);
      const indexA = colorsKeys.indexOf(a.group.name);
      const indexB = colorsKeys.indexOf(b.group.name);

      const colorDiff = indexA - indexB;
      if (colorDiff !== 0) return colorDiff;
    }

    // If still tied, sort by disposition
    // Higher values of CONST.TOKEN_DISPOSITIONS are sorted first (e.g. Friendly).
    const dispositionA = a.token?.disposition ?? 0;
    const dispositionB = b.token?.disposition ?? 0;
    if (dispositionA !== dispositionB) {
      // Return negative to prioritize higher disposition values
      return dispositionB - dispositionA;
    }

    // If still tied, sort by player ownership and retainer status together
    // Player-owned combatants come before non-player-owned ones
    if (a.hasPlayerOwner !== b.hasPlayerOwner) {
      return a.hasPlayerOwner ? -1 : 1;
    }
    if (a.hasPlayerOwner && b.hasPlayerOwner) {
      // Both are player-owned, sort non-retainers first
      const isRetainerA = !!a.system?.retainer?.enabled;
      const isRetainerB = !!b.system?.retainer?.enabled;
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? 1 : -1; // Reverse order for player-owned
      }
    } else if (!a.hasPlayerOwner && !b.hasPlayerOwner) {
      // For non-player owned, sort retainers before non-retainers
      const isRetainerA = !!a.system?.retainer?.enabled;
      const isRetainerB = !!b.system?.retainer?.enabled;
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? -1 : 1;
      }
    }

    // Fall back to ID comparison
    return a.id > b.id ? 1 : -1;
  }
}
