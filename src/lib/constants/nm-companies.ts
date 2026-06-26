export const NM_COMPANIES = [
  'Amway',
  'Herbalife',
  'Vorwerk',
  'Natura & Co',
  'PM-International',
  'Nu Skin',
  'LR Health & Beauty',
  'Zinzino',
  'Ringana',
  'dōTERRA',
  'eXp Realty',
] as const

export type NmCompany = typeof NM_COMPANIES[number]
