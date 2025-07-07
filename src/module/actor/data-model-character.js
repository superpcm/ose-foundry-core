/**
 * @file The data model for Actors of type Character.
 */
import OseDataModelCharacterAC from "./data-model-classes/data-model-character-ac";
import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";
import OseDataModelCharacterScores from "./data-model-classes/data-model-character-scores";
import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";

const getItemsOfActorOfType = (actor, filterType, filterFn = null) =>
  actor.items
    .filter((item) => item?.type === filterType)
    .filter(filterFn || (() => true));

export default class OseDataModelCharacter extends foundry.abstract.TypeDataModel {
  prepareDerivedData() {
    try {
      this.scores = new OseDataModelCharacterScores(this.scores);

      // eslint-disable-next-line new-cap
      this.encumbrance = new CONFIG.OSE.encumbrance(
        this.encumbrance.max,
        [...this.parent.items],
        {
          significantTreasure: game.settings.get(
            game.system.id,
            "significantTreasure"
          ),
          scores: this.scores,
        },
        this.scores.str.mod
      );

      this.movement = new OseDataModelCharacterMove(
        this.encumbrance,
        this.config.movementAuto,
        this.movement.base
      );

      // @todo Once we create the new character sheet,
      //       we shouldn't need to list both AC schemes
      this.ac = new OseDataModelCharacterAC(
        false,
        getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped),
        this.scores.dex.mod,
        this.ac.mod
      );

      this.aac = new OseDataModelCharacterAC(
        true,
        getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped),
        this.scores.dex.mod,
        this.aac.mod
      );

      this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);

      // --- Spell Tab and Bonus Spell Slot Calculation ---
      // Defensively get the class name. It may not be set on a new character.
      const className = this.parent.system.details.class?.toLowerCase() || "";
      const arcaneClasses = ["magic-user", "illusionist", "elf", "half-elf", "gnome", "bard", "mage"];
      const divineClasses = ["cleric", "druid", "paladin", "ranger", "warden", "beast-master"];
      const d6ThiefClasses = ["thief", "assassin", "barbarian"];
      const spellcastingClasses = [...arcaneClasses, ...divineClasses];

      // Automatically enable or disable the spells tab based on the character's class.
      this.spells.enabled = spellcastingClasses.includes(className);

      // First, reset all bonus spells to 0. This is important so that if a score
      // decreases, the character doesn't keep bonuses they no longer qualify for.
      for (let i = 1; i <= 6; i++) {
        if (this.spells[i]) {
          this.spells[i].bonus = 0;
        }
      }

      // House Rule: Arcane bonus spells from high Intelligence
      if (arcaneClasses.includes(className)) {
        const int = this.scores.int.value;
        if (int >= 13 && int <= 14) {
          if (this.spells[1]) this.spells[1].bonus = 1;
        } else if (int >= 15 && int <= 16) {
          if (this.spells[1]) this.spells[1].bonus = 1;
          if (this.spells[2]) this.spells[2].bonus = 1;
        } else if (int >= 17) {
          if (this.spells[1]) this.spells[1].bonus = 1;
          if (this.spells[2]) this.spells[2].bonus = 1;
          if (this.spells[3]) this.spells[3].bonus = 1;
        }
      } // <-- This was missing
    } catch (err) {
      console.error("Error in prepareDerivedData:", err);
    }
  }

  // @todo define schema options; stuff like min/max values and so on.
  static defineSchema() {
    const { StringField, NumberField, BooleanField, ObjectField, SchemaField, ArrayField } =
      foundry.data.fields;
    const scoreField = () => new SchemaField({
      value: new NumberField({ integer: true, min: 0, initial: 0 }),
      bonus: new NumberField({ integer: true, min: 0, initial: 0 }),
    });
    const spellLevelField = () =>
      new SchemaField({
        value: new NumberField({ integer: true, min: 0, initial: 0 }),
        max: new NumberField({ integer: true, min: 0, initial: 0 }),
        bonus: new NumberField({ integer: true, min: 0, initial: 0 }),
      });
    const thiefSkillField = () =>
      new SchemaField({
        value: new NumberField({ integer: true, initial: 1 }),
        spent: new NumberField({ integer: true, initial: 0 }),
      });

    return {
      spells: new SchemaField({
        1: spellLevelField(),
        2: spellLevelField(),
        3: spellLevelField(),
        4: spellLevelField(),
        5: spellLevelField(),
        6: spellLevelField(),
        7: spellLevelField(),
        8: spellLevelField(),
        9: spellLevelField(),
      }),
      scores: new SchemaField({
        str: scoreField(),
        int: scoreField(),
        wis: scoreField(),
        dex: scoreField(),
        con: scoreField(),
        cha: scoreField(),
      }),
      details: new SchemaField({
        class: new StringField({ initial: "" }),
        level: new NumberField({ integer: true, min: 0, initial: 1 }),
        xp: new SchemaField({
          value: new NumberField({ integer: true, min: 0, initial: 0 }),
          bonus: new NumberField({ integer: true, min: 0, initial: 0 }),
        }),
        alignment: new StringField({ initial: "neutral" }),
        biography: new StringField({ initial: "" }),
        notes: new StringField({ initial: "" }),
        movement: new StringField({ initial: "" }),
      }),
      ac: new SchemaField({
        value: new NumberField({ integer: true, initial: 9 }),
        mod: new NumberField({ integer: true, initial: 0 }),
      }),
      aac: new SchemaField({
        value: new NumberField({ integer: true, initial: 10 }),
        mod: new NumberField({ integer: true, initial: 0 }),
      }),
      encumbrance: new SchemaField({
        max: new NumberField({ integer: false, initial: 0 }),
        value: new NumberField({ integer: false, initial: 0 }),
      }),
      movement: new SchemaField({
        base: new NumberField({ integer: true, initial: 120 }),
      }),
      config: new SchemaField({
        movementAuto: new BooleanField({ initial: true }),
      }),
      initiative: new SchemaField({
        value: new NumberField({ integer: false, initial: 0 }),
        mod: new NumberField({ integer: false, initial: 0 }),
      }),
      hp: new SchemaField({
        hd: new StringField({ initial: "" }),
        value: new NumberField({ integer: true, initial: 0 }),
        max: new NumberField({ integer: true, initial: 0 }),
      }),
      thiefskills: new SchemaField({
        usesThiefSkills: new BooleanField({ initial: false }),
        points: new SchemaField({
          value: new NumberField({ integer: true, initial: 0 }),
          spent: new NumberField({ integer: true, initial: 0 }),
        }),
        climb: thiefSkillField(),
        hide: thiefSkillField(),
        listen: thiefSkillField(),
        move: thiefSkillField(),
        open: thiefSkillField(),
        tinker: thiefSkillField(),
      }),
      thac0: new SchemaField({
        value: new NumberField({ integer: true, initial: 20 }),
        bba: new NumberField({ integer: true, initial: -1 }),
        mod: new SchemaField({
          melee: new NumberField({ integer: true, initial: 0 }),
          missile: new NumberField({ integer: true, initial: 0 }),
        }),
      }),
      languages: new SchemaField({
        value: new ArrayField(new StringField(), { initial: [] }),
      }),
      saves: new SchemaField({
        breath: new SchemaField({ value: new NumberField({ integer: true, initial: 0 }) }),
        death: new SchemaField({ value: new NumberField({ integer: true, initial: 0 }) }),
        paralysis: new SchemaField({
          value: new NumberField({ integer: true, initial: 0 }),
        }),
        spell: new SchemaField({ value: new NumberField({ integer: true, initial: 0 }) }),
        wand: new SchemaField({ value: new NumberField({ integer: true, initial: 0 }) }),
      }),
      exploration: new SchemaField({
        ft: new NumberField({ integer: true, positive: true, initial: 0 }),
        ld: new NumberField({ integer: true, positive: true, initial: 0 }),
        od: new NumberField({ integer: true, positive: true, initial: 0 }),
        sd: new NumberField({ integer: true, positive: true, initial: 0 }),
      }),
      retainer: new SchemaField({
        enabled: new BooleanField({ initial: false }),
        loyalty: new NumberField({ integer: true, initial: 0 }),
        wage: new StringField({ initial: "" }),
      }),
    };
  }

  // @todo This only needs to be public until
  //       we can ditch sharing out AC/AAC.
  // eslint-disable-next-line class-methods-use-this
  get usesAscendingAC() {
    return game.settings.get(game.system.id, "ascendingAC");
  }

  get meleeMod() {
    const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    return (
      (this.scores.str?.mod || 0) +
      (this.thac0?.mod?.melee || 0) +
      ascendingAcMod
    );
  }

  get rangedMod() {
    const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    return (
      (this.scores.dex?.mod || 0) +
      (this.thac0?.mod?.missile || 0) +
      ascendingAcMod
    );
  }

  get isNew() {
    const { str, int, wis, dex, con, cha } = this.scores;
    return ![str, int, wis, dex, con, cha].reduce(
      (acc, el) => acc + el.value,
      0
    );
  }

  get containers() {
    return getItemsOfActorOfType(
      this.parent,
      "container",
      (item) => item.system && !item.system.containerId
    );
  }

  get treasures() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      (item) => item.system?.treasure && !item.system?.containerId
    );
  }

  get carriedTreasure() {
    const total = this.treasures.reduce(
      (acc, item) => acc + (item.system?.quantity?.value || 0) * (item.system?.cost || 0),
      0
    );
    return Math.round(total * 100) / 100;
  }

  get items() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      (item) => !item.system?.treasure && !item.system?.containerId
    );
  }

  get weapons() {
    return getItemsOfActorOfType(
      this.parent,
      "weapon",
      (item) => item.system && !item.system.containerId
    );
  }

  get armor() {
    return getItemsOfActorOfType(
      this.parent,
      "armor",
      (item) => item.system && !item.system.containerId
    );
  }

  get abilities() {
    return getItemsOfActorOfType(
      this.parent,
      "ability",
      (item) => item.system && !item.system.containerId
    ).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  get spellList() {
    return getItemsOfActorOfType(
      this.parent,
      "spell",
      (item) => item.system && !item.system.containerId
    );
  }

  get #spellList() {
    // Maintain backwards compatibility
    return this.spellList;
  }

  get isSlow() {
    return this.weapons.length === 0
      ? false
      : this.weapons.some(
          (item) =>
            !(
              item.type !== "weapon" ||
              !item.system.slow ||
              !item.system.equipped
            )
        );
  }

  get init() {
    const group = game.settings.get(game.system.id, "initiative") !== "group";

    return group
      ? (this.initiative.value || 0) +
          (this.initiative.mod || 0) +
          (this.scores.dex.init || 0)
      : 0;
  }
}
