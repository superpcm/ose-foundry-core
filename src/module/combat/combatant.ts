export class OSECombatant extends Combatant {
  static INITIATIVE_VALUE_SLOWED = -789;

  static INITIATIVE_VALUE_DEFEATED = -790;

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isCasting() {
    return this.getFlag(game.system.id, "prepareSpell");
  }

  set isCasting(value) {
    this.setFlag(game.system.id, "prepareSpell", value);
  }

  get isSlow() {
    return this.actor?.system?.isSlow;
  }

  get isDefeated() {
    if (this.defeated) return true;

    return !this.defeated && this.actor?.system?.hp?.value === 0;
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  getInitiativeRoll(formula: string) {
    let term = formula || CONFIG.Combat.initiative.formula;
    if (this.isSlow) term = `${OSECombatant.INITIATIVE_VALUE_SLOWED}`;
    if (this.isDefeated) term = `${OSECombatant.INITIATIVE_VALUE_DEFEATED}`;
    const rollData = this.actor?.getRollData() || {};
    return new Roll(term, rollData);
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    return foundry.utils.mergeObject(context, {
      slow: this.isSlow,
      casting: this.isCasting,
    });
  }

  /**
   * Assign this combatant to a group.
   *
   * @param {string} group - The name of the group to assign this combatant to. If empty, the group will be automatically determined.
   */
  async assignGroup(group: string) {
    if (!group) {
      group = this.groupRaw;
    }

    if (this.group?.name === group) {
      return;
    }

    await this.combat.assignGroup(this, group);
  }

  /**
   * Key for the group to which this combatant should belong.
   *
   * @returns {string} - The group key for this combatant.
   */
  get groupRaw(): string {
    if (this.actor?.system?.isSlow) {
      return "slow";
    }

    const assignedGroup = this.group?.name;
    if (assignedGroup) {
      return assignedGroup;
    }

    switch (this.token?.disposition) {
      case -1:
        return "red";
      case 0:
        return "purple";
      case 1:
        return "green";
      default:
        return "white";
    }
  }
}
