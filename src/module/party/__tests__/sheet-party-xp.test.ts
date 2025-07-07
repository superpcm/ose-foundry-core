/**
 * @file Contains tests for Party XP Sheet.
 */
// eslint-disable-next-line prettier/prettier, import/no-cycle
import { QuenchMethods } from "../../../e2e";
import { openWindows, waitForInput } from "../../../e2e/testUtils";
import OsePartyXP from "../party-xp";

export const key = "ose.party-xp.sheet";
export const options = { displayName: "OSE: Party XP: Sheet" };

export default ({ describe, it, expect, assert }: QuenchMethods) => {
  describe("defaultOptions()", () => {
    it("Has correctly set defaultOptions", () => {
      const partyXP = new OsePartyXP();
      expect(partyXP.options.classes).contain("ose");
      expect(partyXP.options.classes).contain("dialog");
      expect(partyXP.options.classes).contain("party-xp");
      expect(partyXP.options.template).contain("/templates/apps/party-xp.html");
      expect(partyXP.options.width).equal(300);
      expect(partyXP.options.height).equal("auto");
      assert(!partyXP.options.resizable);
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      const partyXP = new OsePartyXP();
      partyXP.render(true);
      await waitForInput();
      const dialogTitle = document.querySelector(
        "div.party-xp .window-title"
      )?.innerHTML;
      expect(typeof dialogTitle).equal("string");
      const dialogs = openWindows("party-xp");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openWindows("party-xp").length).equal(0);
    });
  });

  describe("getData()", () => {
    it("Returns proper data", async () => {
      const sheet = new OsePartyXP();
      const data = await sheet._prepareContext({});
      const keys = Object.keys(data);
      expect(keys.length).to.be.greaterThan(3);
      expect(keys).contain("actors");
      expect(keys).contain("config");
      expect(keys).contain("user");
      expect(keys).contain("settings");
    });
  });

  // @todo: Test with Cypress or similar, or mock event
  describe("_calculateShare()", () => {});
  describe("_dealXP(event)", () => {});
};
