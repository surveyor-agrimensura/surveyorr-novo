const PUBLIC_CUSTOMIZATION_FIELDS = [
  'companyName',
  'responsibleTechnician',
  'professionalRegistry',
  'logoDataUrl'
];

export function publicCustomizationView(customization = {}) {
  const view = {};
  for (const field of PUBLIC_CUSTOMIZATION_FIELDS) {
    if (typeof customization?.[field] === 'string' && customization[field]) {
      view[field] = customization[field];
    }
  }
  return view;
}
