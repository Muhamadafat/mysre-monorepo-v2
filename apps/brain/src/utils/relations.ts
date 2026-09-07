// Shared relation metadata used by the graph, its legend, and the filter chips.
export const relationMapping = {
  background: 'same_background',
  method: 'extended_method',
  goal: 'shares_goal',
  future: 'follows_future_work',
  gap: 'addresses_same_gap',
};

export const relationColors: Record<string, string> = {
  background: 'blue',
  method: 'green',
  gap: 'red',
  future: 'purple',
  goal: 'orange',
};

const relationDisplayNames: Record<string, string> = {
  background: 'Latar Belakang',
  method: 'Metodologi',
  goal: 'Tujuan',
  future: 'Arahan Masa Depan',
  gap: 'Gap Penelitian',
};

export function getRelationDisplayName(relation: string): string {
  return relationDisplayNames[relation] || relation.charAt(0).toUpperCase() + relation.slice(1);
}

export function getRelationColor(relation: string): string {
  const reverseMapping: Record<string, string> = {};
  Object.entries(relationMapping).forEach(([display, api]) => {
    reverseMapping[api] = display;
  });

  const displayRelation = reverseMapping[relation];
  return relationColors[displayRelation] || 'gray';
}

export function getDisplayRelationKey(apiRelation: string): string {
  const reverseMapping: Record<string, string> = {};
  Object.entries(relationMapping).forEach(([display, api]) => {
    reverseMapping[api] = display;
  });
  return reverseMapping[apiRelation] || apiRelation;
}
