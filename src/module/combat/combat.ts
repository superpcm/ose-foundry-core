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

  async #rollAbsolutelyEveryone() {
    const formula = this.isGroupInitiative
      ? OSECombat.GROUP_FORMULA
      : OSECombat.FORMULA;

    await this.rollInitiative(
      this.combatants.map((c) => c.id),
      { formula }
    );
  }

  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  /** @override */
  async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset") await this.#rollAbsolutelyEveryone();
    return this;
  }

  /** @override */
  async _onEndRound(context: CombatRoundEventContext) {
    switch (this.#rerollBehavior) {
      case "reset":
        await this.resetAll();
        break;
      case "reroll":
        await this.#rollAbsolutelyEveryone();
        break;
      case "keep":
      default:
        break;
    }
    await super._onEndRound(context);
    await this.activateCombatant(0);
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
        await this.createEmbeddedDocuments(`CombatantGroup`, [
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

  /**
   * Reroll initiative for all combatants.
   * If the initiative type is set to "group", reroll initiative for each group.
   */
  async rerollGroups() {
    if (!this.isGroupInitiative) {
      return this.#rollAbsolutelyEveryone();
    }

    const updates = [];
    const messages = [];
    for (const group of this.groups) {
      if (group.members.size === 0) continue;

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
}
