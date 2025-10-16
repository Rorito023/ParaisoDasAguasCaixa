// db.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function initDB() {
  // Tabela de usuários
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de mesas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mesas (
      numero INT PRIMARY KEY,
      status VARCHAR(20) DEFAULT 'livre'
    );
  `);

  // Tabela de pedidos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      mesa INT REFERENCES mesas(numero),
      produto VARCHAR(255),
      quantidade INT,
      preco NUMERIC(10,2),
      obs TEXT
    );
  `);

  // Inserir 100 mesas se não existirem
  for (let i = 1; i <= 100; i++) {
    await pool.query(
      `INSERT INTO mesas(numero, status)
       VALUES ($1, 'livre')
       ON CONFLICT (numero) DO NOTHING`,
      [i]
    );
  }
}
