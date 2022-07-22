const currentExtension = imports.misc.extensionUtils.getCurrentExtension();
const { Indicator } = currentExtension.imports.primaryGpu;
const aggregateMenu = imports.ui.main.panel.statusArea.aggregateMenu;
const sessionMode = imports.ui.main.sessionMode;

let indicator = null;

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
}

function disable() {
  if (indicator) {
    aggregateMenu._indicators.remove_child(indicator);
    indicator.menu.destroy();
    indicator = null;
  }
}
