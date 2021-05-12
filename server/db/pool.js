import postgress from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = postgress;

const dbConfig = { connectionString: process.env.DATABASE_URL };
const pool = new Pool(dbConfig);

export default pool;
