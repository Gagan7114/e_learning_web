import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
