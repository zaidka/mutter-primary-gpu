const currentExtension = imports.misc.extensionUtils.getCurrentExtension();
const { Indicator } = currentExtension.imports.primaryGpu;
const aggregateMenu = imports.ui.main.panel.statusArea.aggregateMenu;
const sessionMode = imports.ui.main.sessionMode;

let indicator = null;
let sessionModeSignal = null;

function enable() {
  if (indicator) disable();
  const lookup = [aggregateMenu._power.menu, aggregateMenu._powerProfiles.menu];

  const menuItems = aggregateMenu.menu._getMenuItems();
  let index = 0;
  for (let i = 0; i < menuItems.length; i++) {
    if (lookup.includes(menuItems[i])) index = i;
  }

  indicator = new Indicator();
  aggregateMenu._indicators.add_child(indicator);
  aggregateMenu.menu.addMenuItem(indicator.menu, index + 1);

  indicator.menu.setSensitive(!sessionMode.isLocked);
  sessionModeSignal = sessionMode.connect("updated", () => {
    indicator.menu.setSensitive(!sessionMode.isLocked);
  });
}

function disable() {
  // This extension remains enabled in unlock-dialog mode as it may be helpful
  // for the user to be able to tell which GPU is primary from within the lock
  // screen, since different sessions may have different primary GPU. The menu
  // gets disabled in unlock-dialog though.
  if (!indicator) return;
  sessionMode.disconnect(sessionModeSignal);
  aggregateMenu._indicators.remove_child(indicator);
  indicator.menu.destroy();
  indicator = null;
}
