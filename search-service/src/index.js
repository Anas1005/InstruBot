const express = require('express');
const SearchService = require('./searchService');
require('dotenv').config(); 



const youtubeApiKey = process.env.YOUTUBE_API;
const redisConfig = {
  host: 'redis', // Use the service name defined in docker-compose.yml
  port: 6379
};

// const redisConfig ={

// Initialize SearchService
const searchService = new SearchService(redisConfig, youtubeApiKey);

// Initialize Express app
const app = express();
const PORT = 3002;

app.get('/', (req, res) => {
  res.send('Search server is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
