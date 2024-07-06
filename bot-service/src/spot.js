const axios = require('axios');
require('dotenv').config(); 

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const client_id = process.env.SPOTIFY_ID;
const client_secret = process.env.SPOTIFY_SECRET;
const gemini_api_key = process.env.GEMINI_KEY; // Replace with your actual Gemini API key

console.log("Spot", client_id, gemini_api_key);

const genAI = new GoogleGenerativeAI(gemini_api_key);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 10000,
  responseMimeType: "text/plain",
};

async function searchTrack(query, accessToken) {
  const apiUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const track = response.data.tracks.items[0];
    if (track) {
      return {
        trackName: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        releaseDate: track.album.release_date,
        uri: track.uri
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error searching track:', error.message);
    throw error;
  }
}

async function getAccessToken(client_id, client_secret) {
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const authString = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    const response = await axios.post(tokenUrl, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
}

async function generateEnhanceDescription(trackDetails) {
    const prompt = `
    Here is the information about a song:
  
    🎵 Track: ${trackDetails.trackName}
    👩‍🎤 Artist: ${trackDetails.artist}
    💿 Album: ${trackDetails.album}
    📅 Release Date: ${trackDetails.releaseDate}

      This information will be used to generate a brief, beautifully formatted, and engaging description of the song for Telegram. The goal is to provide a rich user experience. 
  
        Please include:
        1. A short background information.
        2. The main story or inspiration behind the song.
        3. Any notable performances or covers.
        4. One or two interesting trivia or lesser-known facts about the song.
        5. Any major awards or recognitions the song has received.

        Ensure the response is precise, short, and visually appealing for Telegram users with the use of emojis and stickers. Do not include any tags, watermarks, or promotional content from the AI model. Only mention fields and details that actually exist. Do not mention in the reply that it is coming from an AI, to ensure users do not feel awkward.
    `;
  

  const chatSession = model.startChat({
    generationConfig,
    history: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const result = await chatSession.sendMessage(prompt);
  return result.response.text();
}

async function generateDescription(query) {
  try {
    const accessToken = await getAccessToken(client_id, client_secret);
    const trackDetails = await searchTrack(query, accessToken);

    if (trackDetails) {
      const spotifyResponse = `
        🎵 *Track*: ${trackDetails.trackName}
        👩‍🎤 *Artist*: ${trackDetails.artist}
        💿 *Album*: ${trackDetails.album}
        📅 *Release Date*: ${trackDetails.releaseDate}
        🔗 [Listen on Spotify](${trackDetails.uri})
      `;
      console.log("Spotify Response:", spotifyResponse);

      const geminiDescription = await generateEnhanceDescription(trackDetails);
      console.log("Gemini Description:", geminiDescription);

      return geminiDescription;

    } else {
      console.log('Sorry, I couldn’t find any details for that song.');
      return "Sorry";
    //   throw new Error();
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};


module.exports = {generateDescription};