/**
 * @file The data model for Actors of type Monster
 */
// Encumbrance schemes
import OseDataModelCharacterEncumbranceDisabled from "./data-model-classes/data-model-character-encumbrance-disabled";
import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";
import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";

const getItemsOfActorOfType = (actor, filterType, filterFn = null) =>
  actor.items
    .filter((item) => item?.type === filterType)
    .filter(filterFn || (() => true));

export default class OseDataModelMonster extends foundry.abstract.TypeDataModel {
  prepareDerivedData() {
    this.encumbrance = new OseDataModelCharacterEncumbranceDisabled();
    this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);
    this.movement = new OseDataModelCharacterMove(
      this.encumbrance,
      (this.config.movementAuto = false),
      this.movement.base
    );
  }

  /**
   * @inheritdoc
   */
  static migrateData(source) {
    this.#migrateMonsterLanguages(source);

    return super.migrateData(source);
  }

  /**
   * Use an empty array for system.languages.value
   * in order to suppress Polyglot errors.
   *
   * @param {OseDataModelMonster} source - Source data to migrate
   */
  static #migrateMonsterLanguages(source) {
    const languages = source.languages ?? {};

    // If languages.value isn't an iterable, use an empty array
    if (typeof languages?.value?.[Symbol.iterator] !== "function") {
      languages.value = [];
    }
  }

  // @todo define schema options; stuff like min/max values and so on.
  static defineSchema() {
    const { StringField, NumberField, BooleanField, ObjectField, SchemaField, ArrayField } =
      foundry.data.fields;
    const spellLevelField = () =>
      new SchemaField({
        value: new NumberField({ integer: true, min: 0, initial: 0 }),
        max: new NumberField({ integer: true, min: 0, initial: 0 }),
        bonus: new NumberField({ integer: true, min: 0, initial: 0 }),
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
      }),
      details: new SchemaField({
        treasure: new SchemaField({
          table: new StringField({ initial: "" }),
        }),
        biography: new StringField({ initial: "" }),
        morale: new NumberField({ integer: true, min: 0, initial: 7 }),
        appearing: new SchemaField({
          w: new StringField({ initial: "1d4" }),
          d: new StringField({ initial: "1d6" }),
        }),
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
        value: new NumberField({ integer: false, initial: 0 }),
        max: new NumberField({ integer: false, initial: 0 }),
      }),
      movement: new SchemaField({
        base: new NumberField({ integer: true, initial: 120 }),
      }),
      config: new SchemaField({
        movementAuto: new BooleanField({ initial: false }),
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

  get isNew() {
    return !Object.values(this.saves).reduce(
      (prev, curr) => prev + (parseInt(curr?.value, 10) || 0),
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
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get items() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      (item) => !item.system?.treasure && !item.system?.containerId
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get weapons() {
    return getItemsOfActorOfType(
      this.parent,
      "weapon",
      (item) => item.system && !item.system.containerId
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get armor() {
    return getItemsOfActorOfType(
      this.parent,
      "armor",
      (item) => item.system && !item.system.containerId
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get abilities() {
    return getItemsOfActorOfType(
      this.parent,
      "ability",
      (item) => item.system && !item.system.containerId
    ).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  get attackPatterns() {
    return [...this.weapons, ...this.abilities]
      .sort((a, b) => {
        if (
          a.system.pattern !== "transparent" &&
          b.system.pattern === "transparent"
        )
          return -1;
        return b.type.localeCompare(a.type) || a.name.localeCompare(b.name);
      })
      .reduce((prev, curr) => {
        const updated = { ...prev };
        const { pattern } = curr.system;
        if (!updated[pattern]) updated[pattern] = [];
        return { ...updated, [pattern]: [...updated[pattern], curr] };
      }, {});
  }

  get #spellList() {
    return getItemsOfActorOfType(
      this.parent,
      "spell",
      (item) => item.system && !item.system.containerId
    );
  }

  get isSlow() {
    return this.weapons.length === 0
      ? false
      : this.weapons.every(
          (item) => !(item.type !== "weapon" || !item.system.slow)
        );
  }

  get init() {
    const group = game.settings.get(game.system.id, "initiative") !== "group";

    return group
      ? (this.initiative.value || 0) + (this.initiative.mod || 0)
      : 0;
  }
}
