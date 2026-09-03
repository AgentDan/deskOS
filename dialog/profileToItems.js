function buildItemsFromProfile(profile, _graph) {
  const items = ['desk_frame', 'desk_top'];
  const workspace = profile.workspace;
  const monitors = Number(workspace.monitors) || 0;

  if (monitors >= 1) {
    items.push('monitor', 'monitor_arm');
  }
  if (monitors >= 2) {
    items.push('monitor', 'monitor_arm');
  }
  if (monitors >= 3) {
    items.push('monitor', 'monitor_arm');
  }

  if (workspace.laptop === true) {
    items.push('laptop');
  }

  if (workspace.storageRequired === true) {
    items.push('drawer');
  }

  if (workspace.cableManagement === true) {
    items.push('cable_tray', 'power_strip');
  }

  console.log('Built items from profile: ' + items.join(', '));
  return items;
}

module.exports = { buildItemsFromProfile };
