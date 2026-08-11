import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoverageArea,
  getCommunesForRegion,
  isCommuneCovered,
  isOnlineService,
  normalizeCoverageInput,
  normalizeOptionalCoverageInput,
  parseCoverageCommunes,
  shouldIncludeServiceForLocation,
  validateCheckoutCoverage,
} from '../../shared/chileLocations.js';

test('getCommunesForRegion returns canonical RM communes', () => {
  const communes = getCommunesForRegion('RM');

  assert.ok(communes.includes('Providencia'));
  assert.ok(communes.includes('Santiago'));
});

test('getCommunesForRegion returns a copy of the canonical communes', () => {
  const communes = getCommunesForRegion('RM');

  communes.push('Comuna Inventada');

  assert.equal(getCommunesForRegion('RM').includes('Comuna Inventada'), false);
});

test('parseCoverageCommunes accepts JSON string arrays', () => {
  assert.deepEqual(parseCoverageCommunes('["Providencia"," Las Condes ",""]'), ['Providencia', 'Las Condes']);
});

test('parseCoverageCommunes accepts comma-separated strings', () => {
  assert.deepEqual(parseCoverageCommunes('Providencia, Las Condes,, Santiago'), [
    'Providencia',
    'Las Condes',
    'Santiago',
  ]);
});

test('normalizeCoverageInput validates region and keeps unique canonical communes', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia', 'Providencia', 'Las Condes', 'No Existe'],
  });

  assert.deepEqual(coverage, {
    coverage_region_code: 'RM',
    coverage_region_name: 'Region Metropolitana de Santiago',
    coverage_communes: ['Providencia', 'Las Condes'],
    coverage_area: 'Region Metropolitana de Santiago: Providencia, Las Condes',
  });
});

test('normalizeCoverageInput rejects unknown regions', () => {
  assert.throws(
    () => normalizeCoverageInput({ coverage_region_code: 'XX', coverage_communes: ['Santiago'] }),
    /Region no valida/,
  );
});

test('normalizeCoverageInput rejects coverage when no valid communes remain', () => {
  assert.throws(
    () => normalizeCoverageInput({ coverage_region_code: 'RM', coverage_communes: ['No Existe'] }),
    /Selecciona al menos una comuna/,
  );
});

test('allows provider profile payloads to omit coverage during progressive onboarding', () => {
  assert.deepEqual(normalizeOptionalCoverageInput({}), {
    coverage_region_code: null,
    coverage_region_name: null,
    coverage_communes: [],
    coverage_area: null,
  });
});

test('normalizeCoverageInput matches diacritic, case, and repeated whitespace variants', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: ' rm ',
    coverage_communes: ['  nUnOa ', 'Las   Condes'],
  });

  assert.deepEqual(coverage.coverage_communes, ['Nunoa', 'Las Condes']);
});

test('isCommuneCovered checks covered and uncovered communes', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia', 'Las Condes'],
  });

  assert.equal(isCommuneCovered(coverage, 'providencia'), true);
  assert.equal(isCommuneCovered(coverage, ' Las   Condes '), true);
  assert.equal(isCommuneCovered(coverage, 'Santiago'), false);
});

test('buildCoverageArea returns a stable readable summary', () => {
  assert.equal(
    buildCoverageArea('Region Metropolitana de Santiago', ['Providencia', 'Las Condes']),
    'Region Metropolitana de Santiago: Providencia, Las Condes',
  );
});

test('isOnlineService returns true only for online service type', () => {
  assert.equal(isOnlineService('online'), true);
  assert.equal(isOnlineService({ type: ' online ' }), true);
  assert.equal(isOnlineService('presencial'), false);
  assert.equal(isOnlineService('hibrido'), false);
  assert.equal(isOnlineService({ type: 'hibrido' }), false);
});

test('validateCheckoutCoverage reports online, covered, and out-of-coverage states', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia'],
  });

  assert.deepEqual(
    validateCheckoutCoverage({ service_type: 'online', coverage, service_commune: 'Santiago' }),
    { ok: true, reason: 'ONLINE_SERVICE' },
  );
  assert.deepEqual(
    validateCheckoutCoverage({ service_type: 'presencial', coverage, service_commune: 'Providencia' }),
    { ok: true, reason: 'COVERED' },
  );
  assert.deepEqual(
    validateCheckoutCoverage({ service_type: 'presencial', coverage, service_commune: 'Santiago' }),
    { ok: false, reason: 'OUT_OF_COVERAGE' },
  );
});

test('shouldIncludeServiceForLocation includes online services with location filters and no coverage', () => {
  assert.equal(
    shouldIncludeServiceForLocation(
      { type: 'online' },
      { region: 'RM', commune: 'Providencia' },
    ),
    true,
  );
});

test('shouldIncludeServiceForLocation matches presencial services covered by region and commune', () => {
  assert.equal(
    shouldIncludeServiceForLocation(
      {
        type: 'presencial',
        coverage_region_code: 'RM',
        coverage_communes: ['Providencia'],
      },
      { region: 'RM', commune: 'Providencia' },
    ),
    true,
  );
});

test('shouldIncludeServiceForLocation excludes presencial services outside the commune filter', () => {
  assert.equal(
    shouldIncludeServiceForLocation(
      {
        type: 'presencial',
        coverage_region_code: 'RM',
        coverage_communes: ['Las Condes'],
      },
      { region: 'RM', commune: 'Providencia' },
    ),
    false,
  );
});

test('shouldIncludeServiceForLocation matches any selected commune', () => {
  const service = {
    type: 'presencial',
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia', 'Las Condes'],
  };

  assert.equal(
    shouldIncludeServiceForLocation(service, { region: 'RM', communes: ['Santiago', 'Las Condes'] }),
    true,
  );
  assert.equal(
    shouldIncludeServiceForLocation(service, { region: 'RM', commune: 'Santiago,Nunoa' }),
    false,
  );
});

test('validateCheckoutCoverage supports controller service and payload signature', () => {
  const service = {
    type: 'presencial',
    coverage_region_code: 'RM',
    coverage_region_name: 'Region Metropolitana de Santiago',
    coverage_communes: ['Providencia'],
  };

  assert.deepEqual(validateCheckoutCoverage(service, { service_commune: 'Providencia' }), {
    ok: true,
    reason: 'COVERED',
  });
});

test('validateCheckoutCoverage reports missing configured coverage', () => {
  assert.deepEqual(validateCheckoutCoverage({ type: 'presencial' }, { service_commune: 'Providencia' }), {
    ok: false,
    reason: 'COVERAGE_NOT_CONFIGURED',
  });
});

test('validateCheckoutCoverage reports missing checkout commune', () => {
  assert.deepEqual(
    validateCheckoutCoverage(
      {
        type: 'presencial',
        coverage_region_code: 'RM',
        coverage_communes: ['Providencia'],
      },
      {},
    ),
    { ok: false, reason: 'COMMUNE_REQUIRED' },
  );
});

test('validateCheckoutCoverage rejects malformed coverage instead of trusting service data', () => {
  assert.deepEqual(
    validateCheckoutCoverage(
      {
        type: 'presencial',
        coverage_region_code: 'XX',
        coverage_communes: ['Providencia'],
      },
      { service_commune: 'Providencia' },
    ),
    { ok: false, reason: 'COVERAGE_NOT_CONFIGURED' },
  );

  assert.deepEqual(
    validateCheckoutCoverage(
      {
        type: 'presencial',
        coverage_region_code: 'RM',
        coverage_communes: ['No Existe'],
      },
      { service_commune: 'No Existe' },
    ),
    { ok: false, reason: 'COVERAGE_NOT_CONFIGURED' },
  );
});
