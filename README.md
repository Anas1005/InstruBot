# InstruBot 🎶

InstruBot is a Telegram bot designed to provide downloadable instrumental versions of songs, enhancing user engagement with a personalized music experience. The project is built using a **Microservices architecture** and leverages a **Message Broker** for efficient communication between services. Deployed on **AWS EC2**, the entire system operates within **Docker containers**, ensuring scalability, modularity, and easy maintenance.

## Features
- **Request Instrumentals**: Users can request instrumental versions of their favorite songs via the Telegram bot.
- **YouTube Integration**: Utilizes the **YouTube API** to search for videos based on the user’s query.
- **MP3 Conversion**: Downloads the YouTube video and converts it into an MP3 file.
- **Asynchronous Processing**: Communication between services happens through **Redis Queues** and a **Pub/Sub model** for decoupled, asynchronous task handling.
- **Enhanced Engagement**: Users are provided with optional fun facts about the songs, fetched using the **Google Gemini API**.
- **Continuous Deployment**: Automated deployment pipeline using Docker on AWS EC2.

## Architecture

The project follows a microservices architecture consisting of three main services:

1. **Bot Service**: Handles user queries via Telegram, queues the song search request, and eventually responds with the converted MP3 file.
2. **Search Service**: Fetches the YouTube video ID for the requested song and queues it for conversion.
3. **Conversion Service**: Downloads the video and converts it to an MP3 file, ready to be sent to the user.

Each service operates independently in separate **Docker containers**. The inter-service communication is handled through **Redis queues** for asynchronous task processing, while a **Pub/Sub system** coordinates message exchange between the services.

## Technology Stack
- **Node.js**: Server-side JavaScript framework for building services.
- **Telegram Bot API**: For interaction with Telegram users.
- **YouTube API**: Used to search for song videos.
- **Redis**: Employed for queuing and Pub/Sub messaging between services.
- **Google Gemini API**: Fetches additional song-related information for user engagement.
- **AWS EC2**: Deployment environment for hosting the services.
- **Docker**: Containerizes each service for modularity and ease of deployment.

## Workflow
![WhatsApp Image 2024-09-07 at 12 37 35_d03d7712](https://github.com/user-attachments/assets/286995cc-ea88-49f8-8438-0080a0523b46)

1. **User Interaction**: The user sends a request via the Telegram bot, specifying a song.
2. **Search Service**: The bot pushes the request to the **Search Queue**, which is picked up by the Search Service that uses the YouTube API to find the video ID.
3. **Conversion Service**: The video ID is pushed into a **Conversion Queue**, where the Conversion Service downloads the video and converts it to an MP3 file.
4. **Response**: Once converted, the file is returned to the user via the bot.
5. **Engagement**: Optionally, the bot requests additional information about the song using the Google Gemini API and shares it with the user.

## Future Enhancements

- **Error Handling**: Improve resilience with better error handling and retries.
- **Scalability**: Extend the project to support multiple concurrent users.
- **New APIs**: Explore additional music APIs to enhance song search accuracy and engagement.


