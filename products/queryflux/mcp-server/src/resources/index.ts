export function getQueryFluxResources() {
  return [
    {
      uri: 'queryflux://connections',
      name: 'Database Connections',
      description: 'List of all saved database connections',
      mimeType: 'application/json',
    },
  ];
}
