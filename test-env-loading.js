// Test environment variable loading
const dotenv = require('dotenv');
const path = require('path');

console.log('NODE_ENV:', process.env.NODE_ENV);

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

console.log('Loading from:', envPath);
console.log('File exists:', require('fs').existsSync(envPath));

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env:', result.error);
} else {
  console.log('SUCCESS');
}

console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY);
console.log('Length:', process.env.ENCRYPTION_KEY?.length);
