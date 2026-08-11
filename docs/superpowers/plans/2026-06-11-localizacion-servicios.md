# Localizacion de Servicios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Chilean region/comuna service localization using provider-level coverage first, with visible customer filters and checkout coverage validation.

**Architecture:** Add a shared Chile location catalog and coverage utility layer, persist structured coverage on `provider_profiles`, expose coverage through public service APIs, and validate checkout coverage both in the UI and backend. Keep `coverage_area` as a compatibility summary while documenting service-level coverage as a future extension.

**Tech Stack:** React 19, Vite 6, TypeScript with `allowJs`, Express 5, PostgreSQL JSONB, Node built-in `node:test`.

---

## File Structure

- Create `shared/chileLocations.js`: canonical region/comuna catalog and pure coverage helpers used by backend, tests, and frontend.
- Create `server/tests/locationCoverage.test.js`: tests for normalization, commune membership, search matching, and checkout coverage decisions.
- Create `server/scripts/migrations/add_provider_service_location_coverage.sql`: additive migration for provider and booking coverage fields.
- Modify `server/scripts/schema.sql`: keep baseline schema aligned with migration.
- Modify `package.json`: add test scripts using Node built-in test runner.
- Modify `server/controllers/providerController.js`: accept, validate, store, and return structured provider coverage.
- Modify `server/controllers/authController.js`: initialize provider coverage fields without pretending coverage exists.
- Modify `server/controllers/serviceController.js`: include structured coverage in service responses and filter by `region`/`commune`.
- Modify `server/controllers/bookingController.js`: validate selected checkout comuna server-side and store selected location on bookings.
- Create `src/components/common/LocationCoverageSelector.tsx`: reusable region/comuna selector for provider profile, search, category, and checkout.
- Modify `src/routes/AppRoutes.tsx`: pass `region` and `commune` query params into `/search`.
- Modify `src/components/HomePage.tsx`: make location visible in the hero search.
- Modify `src/components/public/SearchResultsPage.tsx`: replace hardcoded location list with region/comuna filters.
- Modify `src/components/public/CategoryDetailPage.tsx`: add region/comuna filtering to category pages.
- Modify `src/components/public/ServiceDetailPage.tsx`: adapt service coverage fields and show coverage in detail.
- Modify `src/components/public/CheckoutPage.tsx`: require location confirmation before payment for presencial/hibrido services.
- Modify `src/components/ServiceCard.tsx`: show a compact coverage badge when available.
- Modify `src/components/public/ProviderPublicProfile.tsx` if it renders `location`: display provider coverage summary using the same `coverage_area` fallback.

## Task 1: Add Shared Chile Coverage Utilities

**Files:**
- Create: `shared/chileLocations.js`
- Create: `server/tests/locationCoverage.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add the failing coverage utility tests**

Create `server/tests/locationCoverage.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoverageArea,
  getCommunesForRegion,
  isCommuneCovered,
  isOnlineService,
  normalizeCoverageInput,
  validateCheckoutCoverage
} from '../../shared/chileLocations.js';

test('returns communes for a Chilean region code', () => {
  const communes = getCommunesForRegion('RM');
  assert.ok(communes.includes('Providencia'));
  assert.ok(communes.includes('Santiago'));
});

test('normalizes provider coverage and removes duplicates', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia', 'Providencia', 'Las Condes', 'No Existe']
  });

  assert.deepEqual(coverage, {
    coverage_region_code: 'RM',
    coverage_region_name: 'Region Metropolitana de Santiago',
    coverage_communes: ['Providencia', 'Las Condes'],
    coverage_area: 'Region Metropolitana de Santiago: Providencia, Las Condes'
  });
});

test('throws when region is unknown', () => {
  assert.throws(() => {
    normalizeCoverageInput({
      coverage_region_code: 'XX',
      coverage_communes: ['Providencia']
    });
  }, /Region no valida/);
});

test('throws when no valid communes remain for a selected region', () => {
  assert.throws(() => {
    normalizeCoverageInput({
      coverage_region_code: 'RM',
      coverage_communes: ['Concepcion']
    });
  }, /Selecciona al menos una comuna/);
});

test('checks if a selected commune is covered', () => {
  const coverage = normalizeCoverageInput({
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia', 'Las Condes']
  });

  assert.equal(isCommuneCovered(coverage, 'Providencia'), true);
  assert.equal(isCommuneCovered(coverage, 'Santiago'), false);
});

test('builds a stable readable coverage summary', () => {
  assert.equal(
    buildCoverageArea('Region Metropolitana de Santiago', ['Providencia', 'Las Condes']),
    'Region Metropolitana de Santiago: Providencia, Las Condes'
  );
});

test('detects online services as not requiring geographic checkout coverage', () => {
  assert.equal(isOnlineService({ type: 'online' }), true);
  assert.equal(isOnlineService({ type: 'presencial' }), false);
  assert.equal(isOnlineService({ type: 'hibrido' }), false);
});

test('validates checkout coverage for presencial services', () => {
  const service = {
    type: 'presencial',
    coverage_region_code: 'RM',
    coverage_region_name: 'Region Metropolitana de Santiago',
    coverage_communes: ['Providencia']
  };

  assert.deepEqual(validateCheckoutCoverage(service, { service_commune: 'Providencia' }), {
    ok: true,
    reason: 'COVERED'
  });

  assert.deepEqual(validateCheckoutCoverage(service, { service_commune: 'Santiago' }), {
    ok: false,
    reason: 'OUT_OF_COVERAGE'
  });
});

test('does not block online checkout by commune', () => {
  assert.deepEqual(validateCheckoutCoverage({ type: 'online' }, {}), {
    ok: true,
    reason: 'ONLINE_SERVICE'
  });
});
```

- [ ] **Step 2: Add test scripts**

Modify `package.json` scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test:coverage-location": "node --test server/tests/locationCoverage.test.js",
  "test": "npm run test:coverage-location"
}
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```powershell
npm.cmd run test:coverage-location
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

The failure should mention `shared/chileLocations.js`, because the implementation does not exist yet.

- [ ] **Step 4: Implement the shared utility**

Create `shared/chileLocations.js`.

Implementation requirements:

```js
export const CHILE_REGIONS = [
  {
    code: 'RM',
    name: 'Region Metropolitana de Santiago',
    communes: [
      'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchali', 'El Bosque',
      'Estacion Central', 'Huechuraba', 'Independencia', 'La Cisterna',
      'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes',
      'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipu', 'Nunoa',
      'Pedro Aguirre Cerda', 'Penalolen', 'Providencia', 'Pudahuel',
      'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquin',
      'San Miguel', 'San Ramon', 'Vitacura', 'Puente Alto', 'Pirque',
      'San Jose de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo',
      'Buin', 'Calera de Tango', 'Paine', 'Melipilla', 'Alhue', 'Curacavi',
      'Maria Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla de Maipo',
      'Padre Hurtado', 'Penaflor'
    ]
  },
  {
    code: 'VALPO',
    name: 'Region de Valparaiso',
    communes: ['Valparaiso', 'Vina del Mar', 'Concon', 'Quilpue', 'Villa Alemana', 'Casablanca', 'San Antonio', 'Los Andes', 'Quillota', 'San Felipe']
  },
  {
    code: 'BIOBIO',
    name: 'Region del Biobio',
    communes: ['Concepcion', 'Talcahuano', 'Chiguayante', 'San Pedro de la Paz', 'Hualpen', 'Coronel', 'Lota', 'Los Angeles']
  }
];

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const getRegionByCode = (code) =>
  CHILE_REGIONS.find((region) => normalizeText(region.code) === normalizeText(code));

export const getCommunesForRegion = (regionCode) => {
  const region = getRegionByCode(regionCode);
  return region ? [...region.communes] : [];
};

export const buildCoverageArea = (regionName, communes) => {
  const cleanCommunes = Array.isArray(communes)
    ? communes.map((commune) => String(commune || '').trim()).filter(Boolean)
    : [];
  return cleanCommunes.length > 0 ? `${regionName}: ${cleanCommunes.join(', ')}` : String(regionName || '').trim();
};

export const parseCoverageCommunes = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

export const normalizeCoverageInput = (input = {}) => {
  const region = getRegionByCode(input.coverage_region_code);
  if (!region) throw new Error('Region no valida');

  const allowed = new Map(region.communes.map((commune) => [normalizeText(commune), commune]));
  const selected = parseCoverageCommunes(input.coverage_communes);
  const unique = [];

  for (const commune of selected) {
    const canonical = allowed.get(normalizeText(commune));
    if (canonical && !unique.includes(canonical)) unique.push(canonical);
  }

  if (unique.length === 0) throw new Error('Selecciona al menos una comuna valida para la region');

  return {
    coverage_region_code: region.code,
    coverage_region_name: region.name,
    coverage_communes: unique,
    coverage_area: buildCoverageArea(region.name, unique)
  };
};

export const isCommuneCovered = (coverage = {}, commune) => {
  const selected = parseCoverageCommunes(coverage.coverage_communes);
  const wanted = normalizeText(commune);
  return selected.some((item) => normalizeText(item) === wanted);
};

export const isOnlineService = (service = {}) => normalizeText(service.type) === 'online';

export const validateCheckoutCoverage = (service = {}, payload = {}) => {
  if (isOnlineService(service)) return { ok: true, reason: 'ONLINE_SERVICE' };
  if (!service.coverage_region_code || parseCoverageCommunes(service.coverage_communes).length === 0) {
    return { ok: false, reason: 'COVERAGE_NOT_CONFIGURED' };
  }
  if (!payload.service_commune) return { ok: false, reason: 'COMMUNE_REQUIRED' };
  if (!isCommuneCovered(service, payload.service_commune)) {
    return { ok: false, reason: 'OUT_OF_COVERAGE' };
  }
  return { ok: true, reason: 'COVERED' };
};
```

Before marking Task 1 complete, expand `CHILE_REGIONS` to include all Chilean regions and communes. Keep codes stable and ASCII. The tests above intentionally require RM, Valparaiso, and Biobio behavior first, but the production data file must cover all Chile.

- [ ] **Step 5: Run the coverage tests and verify pass**

Run:

```powershell
npm.cmd run test:coverage-location
```

Expected:

```text
# pass 8
# fail 0
```

## Task 2: Add Database Migration for Provider and Booking Coverage

**Files:**
- Create: `server/scripts/migrations/add_provider_service_location_coverage.sql`
- Modify: `server/scripts/schema.sql`

- [ ] **Step 1: Write migration SQL**

Create `server/scripts/migrations/add_provider_service_location_coverage.sql`:

```sql
-- Add structured service localization coverage.
-- Alternative A: provider-level coverage.

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS coverage_region_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS coverage_region_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS coverage_communes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_region_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS service_region_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS service_commune VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_region
  ON provider_profiles (coverage_region_code);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_communes
  ON provider_profiles USING GIN (coverage_communes);

CREATE INDEX IF NOT EXISTS idx_bookings_service_location
  ON bookings (service_region_code, service_commune);
```

- [ ] **Step 2: Update baseline schema**

In `server/scripts/schema.sql`, extend `provider_profiles`:

```sql
    coverage_area VARCHAR(255),
    coverage_region_code VARCHAR(10),
    coverage_region_name VARCHAR(120),
    coverage_communes JSONB DEFAULT '[]'::jsonb,
```

Extend `bookings`:

```sql
    service_region_code VARCHAR(10),
    service_region_name VARCHAR(120),
    service_commune VARCHAR(120),
```

- [ ] **Step 3: Verify SQL file exists**

Run:

```powershell
rg -n "coverage_region_code|coverage_communes|service_commune" server\scripts\schema.sql server\scripts\migrations\add_provider_service_location_coverage.sql
```

Expected:

```text
server\scripts\schema.sql:...
server\scripts\migrations\add_provider_service_location_coverage.sql:...
```

## Task 3: Persist Provider Coverage

**Files:**
- Modify: `server/controllers/providerController.js`
- Modify: `server/controllers/authController.js`
- Test: `server/tests/locationCoverage.test.js`

- [ ] **Step 1: Add failing test for empty optional coverage**

Append the import:

```js
import { normalizeOptionalCoverageInput } from '../../shared/chileLocations.js';
```

Append the test:

```js
test('allows provider profile payloads to omit coverage during progressive onboarding', () => {
  assert.deepEqual(normalizeOptionalCoverageInput({}), {
    coverage_region_code: null,
    coverage_region_name: null,
    coverage_communes: [],
    coverage_area: null
  });
});
```

Run:

```powershell
npm.cmd run test:coverage-location
```

Expected failure:

```text
SyntaxError: The requested module '../../shared/chileLocations.js' does not provide an export named 'normalizeOptionalCoverageInput'
```

- [ ] **Step 2: Implement optional coverage normalization**

Add to `shared/chileLocations.js`:

```js
export const normalizeOptionalCoverageInput = (input = {}) => {
  const hasRegion = String(input.coverage_region_code || '').trim().length > 0;
  const hasCommunes = parseCoverageCommunes(input.coverage_communes).length > 0;

  if (!hasRegion && !hasCommunes) {
    return {
      coverage_region_code: null,
      coverage_region_name: null,
      coverage_communes: [],
      coverage_area: null
    };
  }

  return normalizeCoverageInput(input);
};
```

- [ ] **Step 3: Run tests**

Run:

```powershell
npm.cmd run test:coverage-location
```

Expected:

```text
# fail 0
```

- [ ] **Step 4: Modify provider update endpoint**

In `server/controllers/providerController.js`, add import:

```js
import { normalizeOptionalCoverageInput } from '../../shared/chileLocations.js';
import cacheService from '../services/cacheService.js';
```

Update body destructuring:

```js
const {
  full_name,
  phone,
  bio,
  store_name,
  contact_email,
  public_phone,
  public_website,
  instagram_handle,
  bank_data,
  coverage_region_code,
  coverage_communes
} = req.body;
```

Before `const updateQuery`, add:

```js
let normalizedCoverage;
try {
  normalizedCoverage = normalizeOptionalCoverageInput({
    coverage_region_code,
    coverage_communes
  });
} catch (coverageErr) {
  return res.status(400).json({ status: 'error', message: coverageErr.message });
}
```

Extend `UPDATE provider_profiles SET`:

```sql
            coverage_region_code = $14,
            coverage_region_name = $15,
            coverage_communes = $16::jsonb,
            coverage_area = COALESCE($17, coverage_area),
```

Shift existing placeholders so `WHERE user_id = $1` still matches correctly. Add values after `safeBankData`:

```js
normalizedCoverage.coverage_region_code,
normalizedCoverage.coverage_region_name,
JSON.stringify(normalizedCoverage.coverage_communes),
normalizedCoverage.coverage_area
```

After successful update and before `res.json`, flush public service cache:

```js
try {
  cacheService.flush();
} catch (cacheErr) {
  logger.warn(`Could not clear public service cache after provider coverage change: ${cacheErr.message}`);
}
```

- [ ] **Step 5: Modify provider registration placeholder**

In `server/controllers/authController.js`, update provider profile insert from:

```sql
(user_id, full_name, rut, phone, is_verified, bio, coverage_area)
```

to:

```sql
(user_id, full_name, rut, phone, is_verified, bio, coverage_area, coverage_communes)
```

Update values from seven placeholders to eight:

```sql
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

Set values:

```js
'Pendiente',
JSON.stringify([])
```

- [ ] **Step 6: Verify syntax by build**

Run:

```powershell
npm.cmd run build
```

Expected:

```text
built in
```

## Task 4: Add Service Search Coverage Filtering

**Files:**
- Modify: `server/controllers/serviceController.js`
- Test: `server/tests/locationCoverage.test.js`

- [ ] **Step 1: Add tests for SQL search helper**

Append imports:

```js
import { shouldIncludeServiceForLocation } from '../../shared/chileLocations.js';
```

Append tests:

```js
test('search location matching includes online services without coverage', () => {
  assert.equal(shouldIncludeServiceForLocation({ type: 'online' }, { region: 'RM', commune: 'Providencia' }), true);
});

test('search location matching includes covered presencial services', () => {
  assert.equal(shouldIncludeServiceForLocation({
    type: 'presencial',
    coverage_region_code: 'RM',
    coverage_communes: ['Providencia']
  }, { region: 'RM', commune: 'Providencia' }), true);
});

test('search location matching excludes uncovered presencial services', () => {
  assert.equal(shouldIncludeServiceForLocation({
    type: 'presencial',
    coverage_region_code: 'RM',
    coverage_communes: ['Las Condes']
  }, { region: 'RM', commune: 'Providencia' }), false);
});
```

Run:

```powershell
npm.cmd run test:coverage-location
```

Expected failure:

```text
does not provide an export named 'shouldIncludeServiceForLocation'
```

- [ ] **Step 2: Implement search matching helper**

Add to `shared/chileLocations.js`:

```js
export const shouldIncludeServiceForLocation = (service = {}, filters = {}) => {
  if (!filters.region && !filters.commune) return true;
  if (isOnlineService(service)) return true;

  if (filters.region && normalizeText(service.coverage_region_code) !== normalizeText(filters.region)) {
    return false;
  }

  if (filters.commune && !isCommuneCovered(service, filters.commune)) {
    return false;
  }

  return true;
};
```

- [ ] **Step 3: Update service query select fields**

In every public service query in `server/controllers/serviceController.js`, add:

```sql
p.coverage_region_code,
p.coverage_region_name,
p.coverage_communes,
```

Keep:

```sql
p.coverage_area as location
```

Update each matching `GROUP BY` to include:

```sql
p.coverage_region_code, p.coverage_region_name, p.coverage_communes
```

- [ ] **Step 4: Add `region` and `commune` query params**

In `getServices`, change:

```js
const { category, q } = req.query;
```

to:

```js
const { category, q, region, commune } = req.query;
```

After `q` filtering, add:

```js
if (region) {
  params.push(region);
  whereConditions.push(`(
    s.type = 'online'
    OR p.coverage_region_code = $${params.length}
  )`);
}

if (commune) {
  params.push(commune);
  whereConditions.push(`(
    s.type = 'online'
    OR p.coverage_communes ? $${params.length}
  )`);
}
```

- [ ] **Step 5: Update service detail response**

In `getServiceById`, add selected fields:

```sql
p.coverage_region_code,
p.coverage_region_name,
p.coverage_communes,
```

- [ ] **Step 6: Run tests and build**

Run:

```powershell
npm.cmd run test:coverage-location
npm.cmd run build
```

Expected:

```text
# fail 0
built in
```

## Task 5: Add Reusable Location Coverage Selector

**Files:**
- Create: `src/components/common/LocationCoverageSelector.tsx`

- [ ] **Step 1: Create component contract**

Create `src/components/common/LocationCoverageSelector.tsx`:

```tsx
import React, { useMemo } from 'react';
import { MapPin, X } from 'lucide-react';
import { CHILE_REGIONS, getCommunesForRegion } from '../../../shared/chileLocations.js';

interface LocationCoverageSelectorProps {
  regionCode: string;
  communes: string[];
  onRegionChange: (regionCode: string) => void;
  onCommunesChange: (communes: string[]) => void;
  mode?: 'single' | 'multiple';
  label?: string;
  helperText?: string;
  required?: boolean;
}

const LocationCoverageSelector: React.FC<LocationCoverageSelectorProps> = ({
  regionCode,
  communes,
  onRegionChange,
  onCommunesChange,
  mode = 'multiple',
  label = 'Cobertura',
  helperText,
  required = false
}) => {
  const availableCommunes = useMemo(() => getCommunesForRegion(regionCode), [regionCode]);

  const handleRegion = (nextRegion: string) => {
    onRegionChange(nextRegion);
    onCommunesChange([]);
  };

  const toggleCommune = (commune: string) => {
    if (mode === 'single') {
      onCommunesChange(communes.includes(commune) ? [] : [commune]);
      return;
    }
    onCommunesChange(
      communes.includes(commune)
        ? communes.filter((item) => item !== commune)
        : [...communes, commune]
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Region</label>
          <select
            value={regionCode}
            onChange={(event) => handleRegion(event.target.value)}
            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors"
          >
            <option value="">Selecciona region</option>
            {CHILE_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>{region.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Comuna</label>
          <div className="border border-gray-300 rounded-lg bg-white max-h-44 overflow-y-auto p-2">
            {!regionCode ? (
              <p className="text-sm text-gray-400 px-1 py-2">Selecciona una region primero</p>
            ) : availableCommunes.length === 0 ? (
              <p className="text-sm text-gray-400 px-1 py-2">No hay comunas disponibles</p>
            ) : (
              availableCommunes.map((commune) => (
                <label key={commune} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type={mode === 'single' ? 'radio' : 'checkbox'}
                    name={`${label}-commune`}
                    checked={communes.includes(commune)}
                    onChange={() => toggleCommune(commune)}
                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                  />
                  <span className="text-gray-700">{commune}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {communes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {communes.map((commune) => (
            <span key={commune} className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-brand-primary border border-orange-100 px-2.5 py-1 text-xs font-medium">
              <MapPin size={12} />
              {commune}
              <button type="button" onClick={() => onCommunesChange(communes.filter((item) => item !== commune))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationCoverageSelector;
```

- [ ] **Step 2: Verify build**

Run:

```powershell
npm.cmd run build
```

Expected:

```text
built in
```

## Task 6: Add Provider Coverage Configuration UI

**Files:**
- Modify: `src/components/provider/views/ProviderProfile.tsx`

- [ ] **Step 1: Import selector**

Add:

```tsx
import LocationCoverageSelector from '../../common/LocationCoverageSelector';
```

- [ ] **Step 2: Extend initial profile state**

Add fields:

```tsx
coverageRegionCode: '',
coverageCommunes: [],
coverageArea: '',
```

- [ ] **Step 3: Map API profile to state**

Inside `setProfile`, add:

```tsx
coverageRegionCode: p.coverage_region_code || '',
coverageCommunes: Array.isArray(p.coverage_communes) ? p.coverage_communes : [],
coverageArea: p.coverage_area || '',
```

- [ ] **Step 4: Append coverage to provider form submit**

Before `bank_data` or after public fields:

```tsx
formData.append('coverage_region_code', profile.coverageRegionCode);
formData.append('coverage_communes', JSON.stringify(profile.coverageCommunes));
```

- [ ] **Step 5: Add UI block after public contact fields**

Inside the "Informacion Publica" card, after contact privacy notice, add:

```tsx
<div className="border-t border-gray-200 pt-4 mt-4">
  <LocationCoverageSelector
    regionCode={profile.coverageRegionCode}
    communes={profile.coverageCommunes}
    onRegionChange={(coverageRegionCode) => setProfile((prev: any) => ({ ...prev, coverageRegionCode }))}
    onCommunesChange={(coverageCommunes) => setProfile((prev: any) => ({ ...prev, coverageCommunes }))}
    label="Cobertura del servicio"
    helperText="Elige la region y comunas donde atiendes servicios presenciales. Esta informacion se usara en busqueda y checkout."
    required
  />
</div>
```

- [ ] **Step 6: Verify build**

Run:

```powershell
npm.cmd run build
```

Expected:

```text
built in
```

## Task 7: Add Public Search and Category Filters

**Files:**
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/components/HomePage.tsx`
- Modify: `src/components/public/SearchResultsPage.tsx`
- Modify: `src/components/public/CategoryDetailPage.tsx`
- Modify: `src/components/ServiceCard.tsx`

- [ ] **Step 1: Pass location params through navigation**

In `src/routes/AppRoutes.tsx`, in case `'search'`, add:

```tsx
if (params?.region) sp.set('region', params.region);
if (params?.commune) sp.set('commune', params.commune);
```

- [ ] **Step 2: Add location state to HomePage**

In `HomePage`, add:

```tsx
const [selectedRegionCode, setSelectedRegionCode] = useState('');
const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
const selectedCommune = selectedCommunes[0] || '';

const runHeroSearch = () => {
  navigateTo('search', {
    q: searchTerm,
    region: selectedRegionCode,
    commune: selectedCommune
  });
};
```

Import selector:

```tsx
import LocationCoverageSelector from './common/LocationCoverageSelector';
```

Replace existing hero search `onKeyDown` and button `onClick` to call `runHeroSearch`.

Add selector below the search bar:

```tsx
<div className="mt-3 bg-white/80 border border-gray-100 rounded-2xl p-3 max-w-xl mx-auto lg:mx-0">
  <LocationCoverageSelector
    regionCode={selectedRegionCode}
    communes={selectedCommunes}
    onRegionChange={setSelectedRegionCode}
    onCommunesChange={setSelectedCommunes}
    mode="single"
    label="Busca por ubicacion"
    helperText="Selecciona tu comuna para ver servicios disponibles en tu localidad."
  />
</div>
```

- [ ] **Step 3: Replace hardcoded search locations**

In `SearchResultsPage`, remove:

```tsx
const locations = [...]
```

Import selector:

```tsx
import LocationCoverageSelector from '../common/LocationCoverageSelector';
```

Add initial params:

```tsx
const initialRegion = searchParams.get('region') || '';
const initialCommune = searchParams.get('commune') || '';
const [selectedRegionCode, setSelectedRegionCode] = useState<string>(initialRegion);
const [selectedCommunes, setSelectedCommunes] = useState<string[]>(initialCommune ? [initialCommune] : []);
const selectedLocation = selectedCommunes[0] || '';
```

When fetching services, add:

```tsx
if (selectedRegionCode) params.set('region', selectedRegionCode);
if (selectedLocation) params.set('commune', selectedLocation);
```

Add `selectedRegionCode` and `selectedLocation` to fetch effect dependencies.

Remove client-side `matchLoc` from `filteredServices`, because backend now filters. Keep no-location fallback as true.

Replace the location filter UI with:

```tsx
<div className="mb-8">
  <h4 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Ubicacion</h4>
  <LocationCoverageSelector
    regionCode={selectedRegionCode}
    communes={selectedCommunes}
    onRegionChange={setSelectedRegionCode}
    onCommunesChange={setSelectedCommunes}
    mode="single"
    label="Filtrar por comuna"
    helperText="Veras proveedores que atienden esa localidad."
  />
</div>
```

- [ ] **Step 4: Add location filter to CategoryDetailPage**

Import selector and add state:

```tsx
import LocationCoverageSelector from '../common/LocationCoverageSelector';

const [selectedRegionCode, setSelectedRegionCode] = useState('');
const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
const selectedCommune = selectedCommunes[0] || '';
```

Change fetch URL:

```tsx
const params = new URLSearchParams();
params.set('category', categoryId);
if (selectedRegionCode) params.set('region', selectedRegionCode);
if (selectedCommune) params.set('commune', selectedCommune);
const res = await api.get(`/services?${params.toString()}`, { signal: controller.signal });
```

Add dependencies:

```tsx
}, [categoryId, selectedRegionCode, selectedCommune]);
```

Add selector under subcategories:

```tsx
<div className="border-t border-gray-200 pt-6 mt-6">
  <LocationCoverageSelector
    regionCode={selectedRegionCode}
    communes={selectedCommunes}
    onRegionChange={setSelectedRegionCode}
    onCommunesChange={setSelectedCommunes}
    mode="single"
    label="Ubicacion"
    helperText="Filtra por comuna atendida."
  />
</div>
```

- [ ] **Step 5: Add coverage badge to service cards**

In `ServiceCard`, import:

```tsx
import { MapPin, Heart, ImageIcon } from 'lucide-react';
```

Below provider line, add:

```tsx
{service.coverage_region_name || service.location ? (
  <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
    <MapPin size={13} className="text-brand-primary" />
    <span className="line-clamp-1">{service.coverage_region_name || service.location}</span>
  </p>
) : (
  <p className="text-xs text-gray-400 mb-3">Cobertura por confirmar</p>
)}
```

- [ ] **Step 6: Run build**

Run:

```powershell
npm.cmd run build
```

Expected:

```text
built in
```

## Task 8: Add Checkout Coverage Confirmation and Backend Blocking

**Files:**
- Modify: `src/components/public/ServiceDetailPage.tsx`
- Modify: `src/components/public/CheckoutPage.tsx`
- Modify: `server/controllers/bookingController.js`
- Test: `server/tests/locationCoverage.test.js`

- [ ] **Step 1: Adapt service detail coverage fields**

In `ServiceDetailPage`, when adapting API service, add:

```tsx
coverage_region_code: s.coverage_region_code || '',
coverage_region_name: s.coverage_region_name || '',
coverage_communes: Array.isArray(s.coverage_communes) ? s.coverage_communes : [],
```

Change `location` to:

```tsx
location: s.coverage_area || s.coverage_region_name || 'Cobertura por confirmar',
```

- [ ] **Step 2: Add checkout location state**

In `CheckoutPage`, import selector:

```tsx
import LocationCoverageSelector from '../common/LocationCoverageSelector';
```

Add state:

```tsx
const serviceCommunes = Array.isArray(service?.coverage_communes) ? service.coverage_communes : [];
const [selectedRegionCode, setSelectedRegionCode] = useState(service?.coverage_region_code || '');
const [selectedCommunes, setSelectedCommunes] = useState<string[]>(serviceCommunes.length === 1 ? [serviceCommunes[0]] : []);
const selectedCommune = selectedCommunes[0] || '';
const requiresLocationConfirmation = service?.type !== 'online';
const isCommuneAllowed = !requiresLocationConfirmation || (selectedCommune && serviceCommunes.includes(selectedCommune));
```

- [ ] **Step 3: Show confirmation before payment**

In step 1 review, before the guarantee box, add:

```tsx
{requiresLocationConfirmation && (
  <div className={`p-4 rounded-md border mb-6 ${isCommuneAllowed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
    <h4 className={`font-bold mb-2 ${isCommuneAllowed ? 'text-green-800' : 'text-yellow-800'}`}>
      Confirma la comuna del servicio
    </h4>
    <LocationCoverageSelector
      regionCode={selectedRegionCode}
      communes={selectedCommunes}
      onRegionChange={setSelectedRegionCode}
      onCommunesChange={setSelectedCommunes}
      mode="single"
      label="Localidad donde necesitas el servicio"
      helperText="Validaremos que el proveedor atienda esta comuna antes del pago."
      required
    />
    {selectedCommune && isCommuneAllowed && (
      <p className="text-sm text-green-700 mt-3">Este proveedor atiende {selectedCommune}.</p>
    )}
    {selectedCommune && !isCommuneAllowed && (
      <p className="text-sm text-yellow-800 mt-3">Este proveedor no tiene cobertura configurada para {selectedCommune}. Cambia la comuna o elige otro servicio.</p>
    )}
  </div>
)}
```

Disable continue to payment:

```tsx
disabled={requiresLocationConfirmation && !isCommuneAllowed}
```

Add disabled classes:

```tsx
disabled:bg-gray-300 disabled:cursor-not-allowed
```

- [ ] **Step 4: Send selected location to booking APIs**

In authenticated `bookingPayload` and guest `guestPayload`, add:

```tsx
service_region_code: selectedRegionCode || null,
service_region_name: service?.coverage_region_name || null,
service_commune: selectedCommune || null,
```

- [ ] **Step 5: Update backend service fetch in bookings**

In `server/controllers/bookingController.js`, replace both:

```js
const serviceRes = await pool.query('SELECT * FROM services WHERE id = $1', [service_id]);
```

with:

```js
const serviceRes = await pool.query(`
  SELECT s.*, p.coverage_region_code, p.coverage_region_name, p.coverage_communes
  FROM services s
  JOIN provider_profiles p ON s.provider_id = p.user_id
  WHERE s.id = $1
`, [service_id]);
```

- [ ] **Step 6: Validate coverage in booking controller**

Import:

```js
import { validateCheckoutCoverage } from '../../shared/chileLocations.js';
```

In both `createBooking` and `createGuestBooking`, destructure:

```js
service_region_code,
service_region_name,
service_commune
```

After service lookup:

```js
const coverageValidation = validateCheckoutCoverage(service, { service_commune });
if (!coverageValidation.ok) {
  return res.status(400).json({
    status: 'error',
    code: coverageValidation.reason,
    message: coverageValidation.reason === 'OUT_OF_COVERAGE'
      ? 'El proveedor no atiende la comuna seleccionada.'
      : 'Selecciona una comuna valida para confirmar cobertura antes del pago.'
  });
}
```

- [ ] **Step 7: Store selected service location on booking**

In both booking insert column lists, add:

```sql
service_region_code, service_region_name, service_commune,
```

In both values lists, add matching placeholders and values:

```js
service_region_code || service.coverage_region_code || null,
service_region_name || service.coverage_region_name || null,
service_commune || null,
```

- [ ] **Step 8: Run tests and build**

Run:

```powershell
npm.cmd run test:coverage-location
npm.cmd run build
```

Expected:

```text
# fail 0
built in
```

## Task 9: Verify End-to-End Behavior

**Files:**
- No new files.

- [ ] **Step 1: Run automated checks**

Run:

```powershell
npm.cmd run test:coverage-location
npm.cmd run build
```

Expected:

```text
# fail 0
built in
```

- [ ] **Step 2: Start local dev server**

Run:

```powershell
npm.cmd run dev
```

Expected:

```text
Local: http://localhost:3000/
```

- [ ] **Step 3: Manual smoke test provider profile**

Open `http://localhost:3000/provider/dashboard`, go to provider profile, and verify:

- Region selector is visible.
- Commune selector is disabled or empty until region is selected.
- Selecting `Region Metropolitana de Santiago` shows `Providencia`.
- Multiple communes can be selected.
- Save sends `coverage_region_code` and `coverage_communes` in the profile request.

- [ ] **Step 4: Manual smoke test public search**

Open `http://localhost:3000/`, search for a service with region/comuna selected, and verify:

- URL includes `region` and `commune`.
- `/search` keeps those filters selected.
- The request to `/api/services` includes `region` and `commune`.
- Cards show coverage region or neutral fallback.

- [ ] **Step 5: Manual smoke test checkout**

Open a presencial service detail, select date/time, continue to checkout, and verify:

- Checkout asks for service comuna.
- Covered comuna allows continuing to payment.
- Uncovered comuna blocks continuing to payment.
- Booking payload includes `service_region_code`, `service_region_name`, and `service_commune`.

## Self-Review

Spec coverage:

- Provider region and multiple communes: Task 3 and Task 6.
- Customer search filters: Task 4 and Task 7.
- Category filters: Task 7.
- Service detail coverage signal: Task 8.
- Checkout final confirmation: Task 8.
- Backend validation: Task 8.
- Option C documentation: completed in ADR-001 and design spec.

Risk notes:

- `CHILE_REGIONS` must be expanded before production rollout so providers outside RM, Valparaiso, and Biobio can configure coverage.
- Existing DBs need the migration applied before deploying backend changes.
- Public service cache must flush after provider coverage changes, otherwise stale location filters may persist for up to 10 minutes.
- If `npm.cmd run build` exposes unrelated existing encoding or type issues, capture them separately and avoid mixing unrelated refactors into this feature branch.
