/**
 * @file A class to handle the nested AC/AAC props on OseDataModelCharacter.
 */

interface CharacterAC {
  base: number;
  naked: number;
  shield: number;
  value: number;
  mod: number;
}

export default class OseDataModelCharacterAC implements CharacterAC {
  static baseAscending = 10;

  static baseDescending = 9;

  static propAscending = "aac";

  static propDescending = "ac";

  #armor;

  #dexMod;

  #mod;

  #acProp;

  #isAscending;

  /**
   * AC Constructor
   *
   * @param {boolean} isAscending - Is this meant to represent ascending or descending AC?
   * @param {Item} armor - Currently equipped Items with type of armor
   * @param {number} dexMod - The bonus/penalty, from -3 to +3, applied to AC.
   * @param {number} mod - Miscellaneous modifier to AC
   */
  constructor(
    isAscending: boolean = false,
    armor: Item[] = [],
    dexMod: number = 0,
    mod: number = 0
  ) {
    this.#isAscending = isAscending;
    this.#armor = armor;
    this.#dexMod = dexMod;
    this.#mod = mod;
    this.#acProp = this.#isAscending
      ? OseDataModelCharacterAC.propAscending
      : OseDataModelCharacterAC.propDescending;
  }

  #getShieldBonus(): number {
    return (
      this.#armor.find(({ system: { type } }: Item) => type === "shield")
        ?.system[this.#acProp].value || 0
    );
  }

  /**
   * The base AC value for a character, depending on
   * if we're using ascending or descending AC
   *
   * @returns {number} - The base AC value
   */
  get base(): number {
    return this.#isAscending
      ? OseDataModelCharacterAC.baseAscending
      : OseDataModelCharacterAC.baseDescending;
  }

  /**
   * A character's armor class without armor or a shield
   *
   * @returns {number} - The character's naked AC
   */
  get naked(): number {
    return this.#isAscending
      ? this.base + this.#dexMod
      : this.base - this.#dexMod;
  }

  /**
   * A character's shield bonus, if any
   *
   * @returns {number} - The shield bonus
   */
  get shield(): number {
    return this.#getShieldBonus();
  }

  /**
   * The AC value from worn armor
   *
   * @todo After data migration, armor should be a bonus to naked AC.
   * @returns {number | null} - The AC value from worn armor
   */
  get #armored(): number | null {
    const armor = this.#armor.find(
      ({ system: { type } }: Item) => type !== "shield"
    )?.system[this.#acProp].value;
    // Null if any falsy value but 0
    if (!armor && armor !== 0) return null;

    return this.#isAscending ? armor + this.#dexMod : armor - this.#dexMod;
  }

  /**
   * A character's armor class
   *
   * @todo Data migration for armor with AC/AAC to act as a bonus, not an override
   * @returns {number} - The creature's AC
   */
  get value(): number {
    const base = this.#armored === null ? this.naked : this.#armored;
    return this.#isAscending
      ? base + this.shield + this.mod
      : base - this.shield - this.mod;
  }

  // @TODO This will need to be editable once we get to creatures
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  set value(_change: number) {} // eslint-disable-line class-methods-use-this

  /**
   * A character's miscellaneous armor class modifier
   *
   * @returns {number} - The creature's AC modifier
   */
  get mod(): number {
    return this.#mod;
  }

  set mod(change: number) {
    this.#mod = change;
  }
}
