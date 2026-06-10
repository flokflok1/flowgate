import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: ['../.env', '.env'] });

// when running compiled (dist/data-source.js) point at compiled entities/migrations
const compiled = __filename.endsWith('.js');

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: compiled ? ['dist/**/*.orm-entity.js'] : ['src/**/*.orm-entity.ts'],
  migrations: compiled ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
});
