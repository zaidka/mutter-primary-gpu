const currentExtension = imports.misc.extensionUtils.getCurrentExtension();
const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

function init() {
  // 
  if (major < 43) {
    // Import here to avoid incompatible imports for other gnome versions
    const { PrimaryGpuAggregateMenu } = currentExtension.imports.aggregateMenu;
    // Return extension with gnome 42 support
    return new PrimaryGpuAggregateMenu();
  }

  const { PrimaryGpuQuickSettings } = currentExtension.imports.quickSettings;
    // Return extension with gnome 42 support
  return new PrimaryGpuQuickSettings();

  // Unsupported gnome shell version
  // TODO: Throw error
}
