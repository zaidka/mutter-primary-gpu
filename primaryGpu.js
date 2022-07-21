const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const File = imports.gi.Gio.File;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;
const Notification = imports.ui.messageTray.Notification;
const Urgency = imports.ui.messageTray.Urgency;
const SystemNotificationSource =
  imports.ui.messageTray.SystemNotificationSource;
const messageTray = imports.ui.main.messageTray;
const Meta = imports.gi.Meta;

const UDEV_RULE_PATH = "/etc/udev/rules.d/61-mutter-primary-gpu.rules";

function exec(command, envVars = {}) {
  return new Promise((resolve, reject) => {
    const [, strArr] = GLib.shell_parse_argv(command);
    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    for (const [key, value] of Object.entries(envVars)) {
      launcher.setenv(key, value, true);
    }

    const proc = launcher.spawnv(strArr);

    proc.communicate_utf8_async(null, null, (proc, res) => {
      const [arg, stdout, stderr] = proc.communicate_utf8_finish(res);
      if (proc.get_successful()) resolve(stdout);
      else reject(new Error(stderr.trim()));
    });
  });
}

function getActiveGpu() {
  const cmd = "/usr/libexec/gnome-control-center-print-renderer";
  return exec(cmd);
}

async function getRenderer(device) {
  const file = File.new_for_path(`/dev/dri/${device}`);
  if (!file.query_exists(null)) return null;
  const property = await exec(
    `udevadm info --query=property --property=ID_PATH_TAG /dev/dri/${device}`
  );
  const regex = /^ID_PATH_TAG=([a-z0-9_-]+)\n?$/;
  const r = regex.exec(property);
  if (!r) return null;
  return exec("/usr/libexec/gnome-control-center-print-renderer", {
    DRI_PRIME: r[1],
  });
}

function getGpus() {
  const path = File.new_for_path("/dev/dri/");
  const enumerator = path.enumerate_children("standard::name", 0, null);

  const gpus = new Set();

  let f;
  while ((f = enumerator.next_file(null))) {
    const name = f.get_name();
    if (name.startsWith("card")) gpus.add(name);
  }

  return gpus;
}

function getPrimaryGpu() {
  const file = File.new_for_path(UDEV_RULE_PATH);
  if (!file.query_exists(null)) return null;
  const [, contents] = file.load_contents(null);
  const c = ByteArray.toString(contents).trim();
  const regex =
    /^ENV{DEVNAME}=="\/dev\/dri\/(card[\d+])", TAG\+="mutter-device-preferred-primary"$/;
  const r = regex.exec(c);
  if (!r) return null;
  return r[1];
}

function notify(message) {
  const source = new SystemNotificationSource();
  messageTray.add(source);
  const notification = new Notification(source, "Mutter Primary GPU", message, {
    gicon: new Gio.ThemedIcon({ name: "video-display-symbolic" }),
  });
  notification.setTransient(true);
  source.showNotification(notification);
}

function notifyError(err) {
  logError(err);
  const source = new SystemNotificationSource();
  messageTray.add(source);
  const notification = new Notification(
    source,
    "Mutter Primary GPU",
    err.message,
    { gicon: new Gio.ThemedIcon({ name: "video-display-symbolic" }) }
  );
  notification.setTransient(true);
  notification.setUrgency(Urgency.CRITICAL);
  source.showNotification(notification);
}

function setPrimaryGpu(primary) {
  const commands = [];

  // Only way to remove mutter-device-preferred-primary tag that might have been set previosly
  const untagUdevRule = `ENV{DEVNAME}=="/dev/dri/card*", TAG="dummytag"`;
  commands.push(`echo ${GLib.shell_quote(untagUdevRule)} > ${UDEV_RULE_PATH}`);
  commands.push(`udevadm control --reload-rules`);
  commands.push(`udevadm trigger`);

  if (primary) {
    // Add mutter-device-preferred-primary tag
    const tagUdevRule = `ENV{DEVNAME}=="/dev/dri/${primary}", TAG+="mutter-device-preferred-primary"`;
    commands.push(`echo ${GLib.shell_quote(tagUdevRule)} > ${UDEV_RULE_PATH}`);
  } else {
    commands.push(`rm ${UDEV_RULE_PATH}`);
  }

  commands.push(`udevadm control --reload-rules`);
  commands.push(`udevadm trigger`);

  exec(`pkexec sh -c ${GLib.shell_quote(commands.join(" && "))}`)
    .then(() => {
      if (!Meta.is_wayland_compositor())
        notify("Primary GPU selection is only supported on Wayland.");
      else if (primary)
        notify(
          "The selected GPU has been tagged as primary. This change will take effect after the next login."
        );
      else
        notify(
          "The selected GPU is no longer tagged as primary. This change will take effect after the next login."
        );
    })
    .catch(notifyError);
}

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
