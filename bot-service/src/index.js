const express = require('express');
const BotService = require('./botService');
require('dotenv').config(); 

// Replace with your actual values
console.log('Current Working Directory:', process.cwd());
// console.log('Environment Variables:', process.env);

const botToken = process.env.TELEGRAM_TOKEN;
console.log("Bot Token", botToken);
const redisConfig = {
  host: 'redis', // Use the service name defined in docker-compose.yml
  port: 6379
};

// Initialize BotService
const botService = new BotService(botToken, redisConfig);
botService.startBot();

// Initialize Express app
const app = express();
const PORT =  3000;

app.get('/', (req, res) => {
  res.send('Telegram bot server is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`, 'Hello');
});
