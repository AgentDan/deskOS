function buildItemsFromProfile(profile, _graph) {
  const items = ['desk_top'];
  const monitors = Number(profile.workspace.monitors) || 0;

  for (let index = 0; index < monitors; index += 1) {
    items.push('monitor');
  }

  console.log('Built items from profile: ' + items.join(', '));
  return items;
}

module.exports = { buildItemsFromProfile };
