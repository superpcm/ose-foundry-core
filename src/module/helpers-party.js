/**
 * @file Helper functions for managing the Party Sheet
 */
import OsePartySheet from "./party/party-sheet";

/**
 * Add a button to the actor sheet to open the Party Sheet
 *
 * @param {foundry.applications.sidebar.tabs.ActorDirectory} object - The actor directory object
 */
export const addControl = (object) => {
  const html = object.element;
  const control = document.createElement("button");
  control.className = "ose-party-sheet";
  control.type = "button";
  control.title = game.i18n.localize("OSE.dialog.partysheet");
  control.innerHTML = '<i class="fas fa-users"></i>';

  const searchToggle = html.querySelector(".toggle-search-mode");
  if (searchToggle) {
    searchToggle.parentNode.insertBefore(control, searchToggle);
  }

  control.addEventListener("click", (ev) => {
    ev.preventDefault();
    Hooks.call("OSE.Party.showSheet");
  });
};

export const update = (actor) => {
  const partyFlag = actor.getFlag(game.system.id, "party");

  if (partyFlag === null) {
    return;
  }

  OsePartySheet.partySheet.render();
};
