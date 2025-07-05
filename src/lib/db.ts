import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

let isConnected = false;

async function connectDb() {
  if (!isConnected) {
    try {
      await client.connect();
      console.log('Connected to PostgreSQL database');
      isConnected = true;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }
  return client;
}

export { connectDb, client };