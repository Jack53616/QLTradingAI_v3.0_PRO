import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations...');
  
  try {
    // Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    // Get list of executed migrations
    const { rows: executed } = await pool.query('SELECT name FROM migrations');
    const executedNames = new Set(executed.map(r => r.name));
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATE] No migrations directory found, creating...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('[MIGRATE] No migration files found');
      return;
    }
    
    // Run pending migrations
    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`[MIGRATE] Skipping ${file} (already executed)`);
        continue;
      }
      
      console.log(`[MIGRATE] Running ${file}...`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        console.log(`[MIGRATE] ✅ ${file} completed`);
      } catch (error) {
        console.error(`[MIGRATE] ❌ ${file} failed:`, error.message);
        throw error;
      }
    }
    
    console.log('[MIGRATE] All migrations completed successfully');
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('[MIGRATE] Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATE] Error:', error);
      process.exit(1);
    });
}

export { runMigrations };
