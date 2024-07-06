const express = require('express');
const ConverterService = require('./converterService');


const redisConfig = {
  host: 'redis', // Use the service name defined in docker-compose.yml
  port: 6379
};


// Initialize ConverterService
const converterService = new ConverterService(redisConfig);

// Initialize Express apppp
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('Converter server is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
