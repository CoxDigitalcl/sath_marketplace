import { pool } from '../config/db.js';

const EXPECTED_OWNER = 'servicioshogar_servicios_user';

const migrationSql = `
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
`;

const ownerQuery = `
  SELECT schemaname, tablename, tableowner
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('provider_profiles', 'bookings')
  ORDER BY tablename;
`;

const columnQuery = `
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'provider_profiles' AND column_name IN ('coverage_region_code', 'coverage_region_name', 'coverage_communes'))
      OR
      (table_name = 'bookings' AND column_name IN ('service_region_code', 'service_region_name', 'service_commune'))
    )
  ORDER BY table_name, column_name;
`;

async function run() {
  const client = await pool.connect();

  try {
    const userResult = await client.query('SELECT current_user');
    const currentUser = userResult.rows[0]?.current_user;
    console.log(`DB current_user: ${currentUser}`);

    const ownerResult = await client.query(ownerQuery);
    console.table(ownerResult.rows);

    const mismatchedOwners = ownerResult.rows.filter((row) => row.tableowner !== currentUser);
    if (mismatchedOwners.length > 0) {
      console.error('\nNo se puede ejecutar la migracion con este usuario.');
      console.error(`El usuario conectado es "${currentUser}", pero las tablas pertenecen a:`);
      for (const row of mismatchedOwners) {
        console.error(`- ${row.tablename}: ${row.tableowner}`);
      }
      console.error(`\nEjecuta este script con DB_USER=${EXPECTED_OWNER} o con el usuario owner que aparece arriba.`);
      process.exitCode = 1;
      return;
    }

    console.log('\nAplicando migracion de cobertura por region/comuna...');
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');

    console.log('\nMigracion completada. Columnas detectadas:');
    const columnResult = await client.query(columnQuery);
    console.table(columnResult.rows);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures when no transaction is active.
    }

    console.error('\nFallo la migracion de cobertura.');
    console.error(error.message);

    if (error.code === '42501' || /must be owner/i.test(error.message)) {
      console.error('\nEste error es de permisos PostgreSQL: el script se ejecuto, pero DB_USER no es owner de la tabla.');
    }

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
