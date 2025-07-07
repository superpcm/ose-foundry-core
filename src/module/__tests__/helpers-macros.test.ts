/**
 * @file Contains tests for Quench for testing macros
 */
// eslint-disable-next-line import/no-cycle
import { QuenchMethods } from "../../e2e";
import {
  cleanUpActorsByKey,
  cleanUpMacros,
  cleanUpScenes,
  cleanUpWorldItems,
  closeDialogs,
  closeV2Dialogs,
  createActorTestItem,
  createMockActorKey,
  createMockMacro,
  createMockScene,
  createWorldTestItem,
  getActiveNotifications,
  objectIsNotification,
  openV2Dialogs,
  waitForInput,
} from "../../e2e/testUtils";
import { createOseMacro, rollItemMacro } from "../helpers-macros";

export const key = "ose.helpers.macro";
export const options = { displayName: "OSE: Helpers: Macro" };

/* MOCKING HELPERS */
const createMockActor = async (type: string, data: object = {}) =>
  createMockActorKey(type, data, key);

/* CLEAN UP HELPERS */
const cleanUpActors = () => cleanUpActorsByKey(key);

export default ({
  describe,
  it,
  expect,
  before,
  after,
  afterEach,
}: QuenchMethods) => {
  before(async () => {
    game?.scenes?.active?.update({ active: false });
    await ui.notifications?.clear();
  });

  afterEach(async () => {
    await closeV2Dialogs();
    await cleanUpMacros();
    await cleanUpActors();
    await cleanUpWorldItems();
    await cleanUpScenes();
    await ui.notifications?.clear();
  });

  after(async () => {
    await closeDialogs();
    await closeV2Dialogs();
    await cleanUpMacros();
    await cleanUpActors();
    await cleanUpWorldItems();
    await cleanUpScenes();
    await ui.notifications?.clear();
  });

  describe("createOseMacro(data, slot)", () => {
    it("Can create macro", async () => {
      const macro = await createMockMacro();
      expect(game.macros?.contents.find((m) => m.uuid === macro?.uuid)).not
        .undefined;
    });

    it("Can drag Macro to hotbar", async () => {
      const macro = await createMockMacro();
      const data = { type: "Macro", uuid: macro?.uuid };
      const macroSlot = 9;

      await createOseMacro(data, macroSlot);
      const hotbar = game.user?.getHotbarMacros(1);

      expect(hotbar[macroSlot - 1].macro).equal(macro);
    });

    it("Dragging Actor to hotbar send notification", async () => {
      const actor = await createMockActor("character");
      const data = { type: actor?.type, uuid: actor?.uuid };
      const macroSlot = 9;
      const notification = await createOseMacro(data, macroSlot);
      expect(objectIsNotification(notification)).equal(true);
      expect(notification.message).equal(
        game.i18n.localize("OSE.warn.macrosNotAnItem")
      );
      await actor?.delete();
    });

    it("Dragging World Item to hotbar send notification", async () => {
      const actor = await createMockActor("character");
      const worldItem = await createWorldTestItem("weapon");
      const data = { type: "Item", uuid: worldItem?.uuid };
      const macroSlot = 9;
      const notification = await createOseMacro(data, macroSlot);
      expect(objectIsNotification(notification)).equal(true);
      expect(notification.message).equal(
        game.i18n.localize("OSE.warn.macrosOnlyForOwnedItems")
      );
      await actor?.delete();
      await worldItem?.delete();
    });

    describe("Dragging all item types creates macros", () => {
      const itemTypes = new Set([
        "spell",
        "ability",
        "armor",
        "weapon",
        "item",
        "container",
      ]);
      itemTypes.forEach((type) => {
        it(`Dragging Actor ${type.capitalize()} to hotbar craetes macro`, async () => {
          const actor = await createMockActor("character");
          await createActorTestItem(actor, type);
          const item = actor?.items.contents[0];
          const data = {
            type: "Item",
            uuid: item?.uuid,
            item: {
              name: item?.name,
              img: "",
            },
          };
          const macroSlot = 9;

          await createOseMacro(data, macroSlot);
          const macro = game.user?.getHotbarMacros()[macroSlot - 1];
          expect(macro?.macro?.command).equal(
            `game.ose.rollItemMacro("New Actor Test ${type.capitalize()}");`
          );
          await actor?.delete();
        });
      });
    });
  });

  describe("rollItemMacro(itemName)", () => {
    it("No scene creates warning", async () => {
      const type = "weapon";
      const actor = await createMockActor("character");
      await createActorTestItem(actor, type);
      await game.user?.update({ character: actor?.id });
      expect(ChatMessage.getSpeaker().scene).is.null;
      expect(ChatMessage.getSpeaker().actor).is.not.null;
      const notification = await rollItemMacro(
        `New Actor Test ${type.capitalize()}`
      );
      expect(objectIsNotification(notification)).equal(true);
      expect(notification.message).equal(
        game.i18n.localize("OSE.warn.macrosNoTokenOwnedInScene")
      );
      await actor?.delete();
    });

    it("No assigned actor creates warning", async () => {
      const type = "weapon";
      const actor = await createMockActor("character");
      const scene = await createMockScene();
      expect(scene?.tokenVision).equal(true);
      await createActorTestItem(actor, type);
      await game.user?.update({ character: null });
      expect(ChatMessage.getSpeaker().scene).is.not.null;
      expect(ChatMessage.getSpeaker().actor).is.null;
      const notification = await rollItemMacro(
        `New Actor Test ${type.capitalize()}`
      );
      expect(objectIsNotification(notification)).equal(true);
      expect(notification.message).equal(
        game.i18n.localize("OSE.warn.macrosNoTokenOwnedInScene")
      );
      await actor?.delete();
      await scene?.delete();
    });

    it("Scene & assigned actor creates roll", async () => {
      const type = "weapon";
      const actor = await createMockActor("character");
      const scene = await createMockScene();
      expect(scene?.tokenVision).equal(true);
      await createActorTestItem(actor, type);
      await game.user?.update({ character: actor?.id });
      expect(ChatMessage.getSpeaker().scene).is.not.null;
      expect(ChatMessage.getSpeaker().actor).is.not.null;
      await rollItemMacro(`New Actor Test ${type.capitalize()}`);
      await waitForInput();
      expect(openV2Dialogs().length).equal(1);
      await closeV2Dialogs();
      await actor?.delete();
      await scene?.delete();
    });

    it("Duplicate item creates warning but also creates rolls", async () => {
      const type = "weapon";
      const actor = await createMockActor("character");
      const scene = await createMockScene();
      expect(scene?.tokenVision).equal(true);
      await createActorTestItem(actor, type);
      await createActorTestItem(actor, type);
      await game.user?.update({ character: actor?.id });
      await rollItemMacro(`New Actor Test ${type.capitalize()}`);
      await waitForInput();
      expect(getActiveNotifications().map((li) => li?.textContent?.trim()))
        .to.be.an("array")
        .that.includes(
          game.i18n.format("OSE.warn.moreThanOneItemWithName", {
            actorName: actor?.name,
            itemName: `New Actor Test ${type.capitalize()}`,
          })
        );
      await waitForInput();
      expect(openV2Dialogs().length).equal(1);
      await closeV2Dialogs();
      await actor?.delete();
      await scene?.delete();
    });

    it("Missing item creates warning", async () => {
      const type = "weapon";
      const actor = await createMockActor("character");
      const scene = await createMockScene();
      expect(scene?.tokenVision).equal(true);
      await createActorTestItem(actor, type);
      await game.user?.update({ character: actor?.id });
      await actor?.items
        .getName(`New Actor Test ${type.capitalize()}`)
        ?.delete();
      const notification = await rollItemMacro(
        `New Actor Test ${type.capitalize()}`
      );
      await waitForInput();
      expect(objectIsNotification(notification)).equal(true);
      expect(notification.type).equal("error");
      expect(notification.message).equal(
        game.i18n.format("OSE.error.noItemWithName", {
          actorName: actor?.name,
          itemName: `New Actor Test ${type.capitalize()}`,
        })
      );
      await actor?.delete();
      await scene?.delete();
    });
  });
};
