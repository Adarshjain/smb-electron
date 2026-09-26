export const ID_PROOF_TYPES = [
  'Aadhaar Card',
  'Voter ID',
  'Driving Licence',
  'PAN Card',
  'Ration Card',
  'Passport',
];

// Starts-with matches first, then contains matches; empty until the user types
export function filterIdProofTypes(search: string): string[] {
  const searchLower = search.trim().toLowerCase();
  if (!searchLower) return [];
  return [
    ...new Set([
      ...ID_PROOF_TYPES.filter((type) =>
        type.toLowerCase().startsWith(searchLower)
      ),
      ...ID_PROOF_TYPES.filter((type) =>
        type.toLowerCase().includes(searchLower)
      ),
    ]),
  ];
}
