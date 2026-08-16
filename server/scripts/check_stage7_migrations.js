import fs from 'node:fs';
import path from 'node:path';

const migrationsDirectory = path.resolve('server/scripts/migrations');
const schemaPath = path.resolve('server/scripts/schema.sql');
const migrationName = /^[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const destructiveSql = /\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i;
const requiredSchemaTables = ['users', 'provider_profiles', 'services', 'bookings'];
const errors = [];

const migrationFiles = fs.readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

if (migrationFiles.length === 0) {
    errors.push('No SQL migrations were found.');
}

for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDirectory, file);
    const sql = fs.readFileSync(fullPath, 'utf8').trim();

    if (!migrationName.test(file)) {
        errors.push(`${file}: filename must use lower_snake_case.sql.`);
    }
    if (!sql) {
        errors.push(`${file}: migration is empty.`);
        continue;
    }
    if (!sql.endsWith(';')) {
        errors.push(`${file}: final SQL statement must end with a semicolon.`);
    }
    if (destructiveSql.test(sql) && !sql.includes('stage7-allow-destructive')) {
        errors.push(`${file}: destructive SQL requires an explicit stage7-allow-destructive review marker.`);
    }
}

const schema = fs.readFileSync(schemaPath, 'utf8');
for (const table of requiredSchemaTables) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i');
    if (!tablePattern.test(schema)) {
        errors.push(`schema.sql: required table ${table} is missing.`);
    }
}

if (errors.length > 0) {
    console.error('Migration validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Migration validation passed: ${migrationFiles.length} migrations and clean-schema baseline checked.`);
}
