const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const CHILE_REGIONS = [
  {
    code: 'AP',
    name: 'Region de Arica y Parinacota',
    communes: ['Arica', 'Camarones', 'Putre', 'General Lagos'],
  },
  {
    code: 'TA',
    name: 'Region de Tarapaca',
    communes: ['Iquique', 'Alto Hospicio', 'Camina', 'Colchane', 'Huara', 'Pica', 'Pozo Almonte'],
  },
  {
    code: 'AN',
    name: 'Region de Antofagasta',
    communes: [
      'Antofagasta',
      'Mejillones',
      'Sierra Gorda',
      'Taltal',
      'Calama',
      'Ollague',
      'San Pedro de Atacama',
      'Tocopilla',
      'Maria Elena',
    ],
  },
  {
    code: 'AT',
    name: 'Region de Atacama',
    communes: [
      'Copiapo',
      'Caldera',
      'Tierra Amarilla',
      'Chanaral',
      'Diego de Almagro',
      'Vallenar',
      'Alto del Carmen',
      'Freirina',
      'Huasco',
    ],
  },
  {
    code: 'CO',
    name: 'Region de Coquimbo',
    communes: [
      'La Serena',
      'Coquimbo',
      'Andacollo',
      'La Higuera',
      'Paiguano',
      'Vicuna',
      'Illapel',
      'Canela',
      'Los Vilos',
      'Salamanca',
      'Ovalle',
      'Combarbala',
      'Monte Patria',
      'Punitaqui',
      'Rio Hurtado',
    ],
  },
  {
    code: 'VA',
    name: 'Region de Valparaiso',
    communes: [
      'Valparaiso',
      'Casablanca',
      'Concon',
      'Juan Fernandez',
      'Puchuncavi',
      'Quintero',
      'Vina del Mar',
      'Isla de Pascua',
      'Los Andes',
      'Calle Larga',
      'Rinconada',
      'San Esteban',
      'Quilpue',
      'Limache',
      'Olmue',
      'Villa Alemana',
      'La Ligua',
      'Cabildo',
      'Papudo',
      'Petorca',
      'Zapallar',
      'Quillota',
      'La Calera',
      'Hijuelas',
      'La Cruz',
      'Nogales',
      'San Antonio',
      'Algarrobo',
      'Cartagena',
      'El Quisco',
      'El Tabo',
      'Santo Domingo',
      'San Felipe',
      'Catemu',
      'Llaillay',
      'Panquehue',
      'Putaendo',
      'Santa Maria',
    ],
  },
  {
    code: 'OH',
    name: "Region del Libertador General Bernardo O'Higgins",
    communes: [
      'Rancagua',
      'Codegua',
      'Coinco',
      'Coltauco',
      'Donihue',
      'Graneros',
      'Las Cabras',
      'Machali',
      'Malloa',
      'Mostazal',
      'Olivar',
      'Peumo',
      'Pichidegua',
      'Quinta de Tilcoco',
      'Rengo',
      'Requinoa',
      'San Vicente de Tagua Tagua',
      'Pichilemu',
      'La Estrella',
      'Litueche',
      'Marchihue',
      'Navidad',
      'Paredones',
      'San Fernando',
      'Chepica',
      'Chimbarongo',
      'Lolol',
      'Nancagua',
      'Palmilla',
      'Peralillo',
      'Placilla',
      'Pumanque',
      'Santa Cruz',
    ],
  },
  {
    code: 'ML',
    name: 'Region del Maule',
    communes: [
      'Talca',
      'Constitucion',
      'Curepto',
      'Empedrado',
      'Maule',
      'Pelarco',
      'Pencahue',
      'Rio Claro',
      'San Clemente',
      'San Rafael',
      'Cauquenes',
      'Chanco',
      'Pelluhue',
      'Curico',
      'Hualane',
      'Licanten',
      'Molina',
      'Rauco',
      'Romeral',
      'Sagrada Familia',
      'Teno',
      'Vichuquen',
      'Linares',
      'Colbun',
      'Longavi',
      'Parral',
      'Retiro',
      'San Javier de Loncomilla',
      'Villa Alegre',
      'Yerbas Buenas',
    ],
  },
  {
    code: 'NB',
    name: 'Region de Nuble',
    communes: [
      'Bulnes',
      'Chillan',
      'Chillan Viejo',
      'El Carmen',
      'Pemuco',
      'Pinto',
      'Quillon',
      'San Ignacio',
      'Yungay',
      'Cobquecura',
      'Coelemu',
      'Ninhue',
      'Portezuelo',
      'Quirihue',
      'Ranquil',
      'Treguaco',
      'Coihueco',
      'Niquen',
      'San Carlos',
      'San Fabian',
      'San Nicolas',
    ],
  },
  {
    code: 'BI',
    name: 'Region del Biobio',
    communes: [
      'Concepcion',
      'Coronel',
      'Chiguayante',
      'Florida',
      'Hualqui',
      'Lota',
      'Penco',
      'San Pedro de la Paz',
      'Santa Juana',
      'Talcahuano',
      'Tome',
      'Hualpen',
      'Lebu',
      'Arauco',
      'Canete',
      'Contulmo',
      'Curanilahue',
      'Los Alamos',
      'Tirua',
      'Los Angeles',
      'Antuco',
      'Cabrero',
      'Laja',
      'Mulchen',
      'Nacimiento',
      'Negrete',
      'Quilaco',
      'Quilleco',
      'San Rosendo',
      'Santa Barbara',
      'Tucapel',
      'Yumbel',
      'Alto Biobio',
    ],
  },
  {
    code: 'AR',
    name: 'Region de La Araucania',
    communes: [
      'Temuco',
      'Carahue',
      'Cunco',
      'Curarrehue',
      'Freire',
      'Galvarino',
      'Gorbea',
      'Lautaro',
      'Loncoche',
      'Melipeuco',
      'Nueva Imperial',
      'Padre Las Casas',
      'Perquenco',
      'Pitrufquen',
      'Pucon',
      'Saavedra',
      'Teodoro Schmidt',
      'Tolten',
      'Vilcun',
      'Villarrica',
      'Cholchol',
      'Angol',
      'Collipulli',
      'Curacautin',
      'Ercilla',
      'Lonquimay',
      'Los Sauces',
      'Lumaco',
      'Puren',
      'Renaico',
      'Traiguen',
      'Victoria',
    ],
  },
  {
    code: 'LR',
    name: 'Region de Los Rios',
    communes: [
      'Valdivia',
      'Corral',
      'Lanco',
      'Los Lagos',
      'Mafil',
      'Mariquina',
      'Paillaco',
      'Panguipulli',
      'Futrono',
      'La Union',
      'Lago Ranco',
      'Rio Bueno',
    ],
  },
  {
    code: 'LL',
    name: 'Region de Los Lagos',
    communes: [
      'Puerto Montt',
      'Calbuco',
      'Cochamo',
      'Fresia',
      'Frutillar',
      'Los Muermos',
      'Llanquihue',
      'Maullin',
      'Puerto Varas',
      'Castro',
      'Ancud',
      'Chonchi',
      'Curaco de Velez',
      'Dalcahue',
      'Puqueldon',
      'Queilen',
      'Quellon',
      'Quemchi',
      'Quinchao',
      'Osorno',
      'Puerto Octay',
      'Purranque',
      'Puyehue',
      'Rio Negro',
      'San Juan de la Costa',
      'San Pablo',
      'Chaiten',
      'Futaleufu',
      'Hualaihue',
      'Palena',
    ],
  },
  {
    code: 'AI',
    name: 'Region de Aysen del General Carlos Ibanez del Campo',
    communes: [
      'Coihaique',
      'Lago Verde',
      'Aisen',
      'Cisnes',
      'Guaitecas',
      'Cochrane',
      "O'Higgins",
      'Tortel',
      'Chile Chico',
      'Rio Ibanez',
    ],
  },
  {
    code: 'MA',
    name: 'Region de Magallanes y de la Antartica Chilena',
    communes: [
      'Punta Arenas',
      'Laguna Blanca',
      'Rio Verde',
      'San Gregorio',
      'Cabo de Hornos',
      'Antartica',
      'Porvenir',
      'Primavera',
      'Timaukel',
      'Natales',
      'Torres del Paine',
    ],
  },
  {
    code: 'RM',
    name: 'Region Metropolitana de Santiago',
    communes: [
      'Santiago',
      'Cerrillos',
      'Cerro Navia',
      'Conchali',
      'El Bosque',
      'Estacion Central',
      'Huechuraba',
      'Independencia',
      'La Cisterna',
      'La Florida',
      'La Granja',
      'La Pintana',
      'La Reina',
      'Las Condes',
      'Lo Barnechea',
      'Lo Espejo',
      'Lo Prado',
      'Macul',
      'Maipu',
      'Nunoa',
      'Pedro Aguirre Cerda',
      'Penalolen',
      'Providencia',
      'Pudahuel',
      'Quilicura',
      'Quinta Normal',
      'Recoleta',
      'Renca',
      'San Joaquin',
      'San Miguel',
      'San Ramon',
      'Vitacura',
      'Puente Alto',
      'Pirque',
      'San Jose de Maipo',
      'Colina',
      'Lampa',
      'Tiltil',
      'San Bernardo',
      'Buin',
      'Calera de Tango',
      'Paine',
      'Melipilla',
      'Alhue',
      'Curacavi',
      'Maria Pinto',
      'San Pedro',
      'Talagante',
      'El Monte',
      'Isla de Maipo',
      'Padre Hurtado',
      'Penaflor',
    ],
  },
];

for (const region of CHILE_REGIONS) {
  Object.freeze(region.communes);
  Object.freeze(region);
}

Object.freeze(CHILE_REGIONS);

export const getRegionByCode = (regionCode) => {
  const requestedCode = normalizeText(regionCode);

  return CHILE_REGIONS.find((region) => normalizeText(region.code) === requestedCode) ?? null;
};

export const getCommunesForRegion = (regionCode) => [...(getRegionByCode(regionCode)?.communes ?? [])];

export const buildCoverageArea = (regionName, communes) => {
  const cleanCommunes = parseCoverageCommunes(communes);

  return cleanCommunes.length > 0 ? `${regionName}: ${cleanCommunes.join(', ')}` : String(regionName ?? '').trim();
};

export const parseCoverageCommunes = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated input.
  }

  return trimmedValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeCoverageInput = (input = {}) => {
  const region = getRegionByCode(input.coverage_region_code);

  if (!region) {
    throw new Error('Region no valida');
  }

  const canonicalByName = new Map(region.communes.map((commune) => [normalizeText(commune), commune]));
  const normalizedCommunes = [];
  const selected = new Set();

  for (const commune of parseCoverageCommunes(input.coverage_communes)) {
    const canonicalCommune = canonicalByName.get(normalizeText(commune));

    if (canonicalCommune && !selected.has(canonicalCommune)) {
      selected.add(canonicalCommune);
      normalizedCommunes.push(canonicalCommune);
    }
  }

  if (normalizedCommunes.length === 0) {
    throw new Error('Selecciona al menos una comuna valida');
  }

  return {
    coverage_region_code: region.code,
    coverage_region_name: region.name,
    coverage_communes: normalizedCommunes,
    coverage_area: buildCoverageArea(region.name, normalizedCommunes),
  };
};

export const normalizeOptionalCoverageInput = (input = {}) => {
  const hasRegion = String(input.coverage_region_code || '').trim().length > 0;
  const hasCommunes = parseCoverageCommunes(input.coverage_communes).length > 0;

  if (!hasRegion && !hasCommunes) {
    return {
      coverage_region_code: null,
      coverage_region_name: null,
      coverage_communes: [],
      coverage_area: null,
    };
  }

  return normalizeCoverageInput(input);
};

export const isCommuneCovered = (coverage, serviceCommune) => {
  const requestedCommune = normalizeText(serviceCommune);

  if (!requestedCommune || !coverage) {
    return false;
  }

  return parseCoverageCommunes(coverage.coverage_communes).some((commune) => normalizeText(commune) === requestedCommune);
};

export const isOnlineService = (service = {}) => {
  const serviceType = typeof service === 'string' ? service : service.type ?? service.service_type;

  return normalizeText(serviceType) === 'online';
};

const getCoverageSource = (service) => service.coverage ?? service;

export const shouldIncludeServiceForLocation = (service = {}, filters = {}) => {
  const requestedRegion = normalizeText(filters.region);
  const requestedCommunes = parseCoverageCommunes(filters.communes ?? filters.commune);

  if (!requestedRegion && requestedCommunes.length === 0) {
    return true;
  }

  if (isOnlineService(service)) {
    return true;
  }

  const coverageSource = getCoverageSource(service);

  if (requestedRegion && normalizeText(coverageSource.coverage_region_code) !== requestedRegion) {
    return false;
  }

  if (
    requestedCommunes.length > 0
    && !requestedCommunes.some((commune) => isCommuneCovered(coverageSource, commune))
  ) {
    return false;
  }

  return true;
};

export const validateCheckoutCoverage = (service = {}, payload = {}) => {
  if (isOnlineService(service)) {
    return { ok: true, reason: 'ONLINE_SERVICE' };
  }

  const coverageSource = getCoverageSource(service);

  if (
    !coverageSource ||
    !coverageSource.coverage_region_code ||
    parseCoverageCommunes(coverageSource.coverage_communes).length === 0
  ) {
    return { ok: false, reason: 'COVERAGE_NOT_CONFIGURED' };
  }

  let normalizedCoverage;

  try {
    normalizedCoverage = normalizeCoverageInput({
      coverage_region_code: coverageSource.coverage_region_code,
      coverage_communes: coverageSource.coverage_communes,
    });
  } catch {
    return { ok: false, reason: 'COVERAGE_NOT_CONFIGURED' };
  }

  const service_commune = payload.service_commune ?? service.service_commune;

  if (!normalizeText(service_commune)) {
    return { ok: false, reason: 'COMMUNE_REQUIRED' };
  }

  if (!isCommuneCovered(normalizedCoverage, service_commune)) {
    return { ok: false, reason: 'OUT_OF_COVERAGE' };
  }

  return { ok: true, reason: 'COVERED' };
};
