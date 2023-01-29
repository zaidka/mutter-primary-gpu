const currentExtension = imports.misc.extensionUtils.getCurrentExtension();
const { getActiveGpu, getGpus, getPrimaryGpu, getRenderer, setPrimaryGpu } = currentExtension.imports.primaryGpu;
const aggregateMenu = imports.ui.main.panel.statusArea.aggregateMenu;


var Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.SystemIndicator {
      _init() {
        super._init();
        this._item = new PopupMenu.PopupSubMenuMenuItem("", true);
        getActiveGpu()
          .then((prm) => {
            this._item.label.text = prm;
          })
          .catch(logError);
  
        this._item.icon.icon_name = "video-display-symbolic";
  
        this._item.menu.connect("open-state-changed", (_, open) => {
          if (open) this._sync();
        });
  
        this.menu.addMenuItem(this._item);
  
        this._sync();
      }
  
      _sync() {
        const gpus = getGpus();
        const primary = getPrimaryGpu();
        if (primary) gpus.add(primary);
        const proms = [...gpus].map(async (gpu) => {
          const label = await getRenderer(gpu);
          const item = new PopupMenu.PopupMenuItem(label ?? `/dev/dri/${gpu}`);
          item.setOrnament(
            gpu === primary ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
          );
          item.connect("activate", () => {
            setPrimaryGpu(gpu === primary ? null : gpu);
          });
          return item;
        });
  
        Promise.all(proms)
          .then((items) => {
            this._item.menu.removeAll();
            for (const item of items) this._item.menu.addMenuItem(item);
          })
          .catch(logError);
      }
    }
  );

var PrimaryGpuAggregateMenu = class PrimaryGpuAggregateMenu {
    constructor() {
        this._indicator = null;
    }
    
    enable() {
        if (this._indicator) disable();

        const lookup = [aggregateMenu._power.menu, aggregateMenu._powerProfiles.menu];

        const menuItems = aggregateMenu.menu._getMenuItems();
        let index = 0;
        for (let i = 0; i < menuItems.length; i++) {
            if (lookup.includes(menuItems[i])) index = i;
        }

        this._indicator = new Indicator();
        aggregateMenu._indicators.add_child(this._indicator);
        aggregateMenu.menu.addMenuItem(this._indicator.menu, index + 1);
    }
    
    disable() {
        if (this._indicator) {
            aggregateMenu._indicators.remove_child(this._indicator);
            this._indicator.menu.destroy();
            this._indicator = null;
        }
    }
}