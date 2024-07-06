const { Telegraf } = require("telegraf");
const Redis = require("ioredis");
const { Worker, Queue } = require("bullmq");
const axios = require("axios");

class SearchService {
  constructor(redisConfig, youtubeApiKey) {
    this.worker = new Worker("song-queries", this.processJob.bind(this), {
      connection: redisConfig
    });

    this.progressQu = new Queue("progress-updates", {
      connection: redisConfig
    });

    this.redisQueue = new Queue("videos-to-convert", {
      connection: redisConfig
    });

    this.publisher = new Redis(redisConfig);

    this.youtubeApiKey = youtubeApiKey;
  }

  async processJob(job) {
    await this.startSearching(job);
  }

  async startSearching(job) {
    console.log("Popped ", job.data);
    await this.handleSearch(job.data);
  }

  async handleSearch({ userId, query, raw }) {
    try {
      await this.progressQu.add("submit-job", {
        userId,
        step: "searching_video",
        progress: 0.5,
      });
      const { videoId, title } = await this.searchYouTube(query);
      if (videoId) {
        await this.redisQueue.add("submit-job", {
          userId,
          videoId,
          title,
          raw,
        });
        console.log(
          `🎬 Video ID "${title}" pushed to conversion queue for user ${userId}`
        );
      } else {
        console.error("❌ No video found for query:", query);
      }
    } catch (error) {
      console.error("❌ Error in handleSearch:", error);
    }
  }

  async searchYouTube(query) {
    console.log("🔍 Querying YouTube:", query);
    try {
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: query,
            type: "video",
            key: this.youtubeApiKey,
            maxResults: 5,
          },
        }
      );

      if (response.data.items.length > 0) {
        return {
          videoId: response.data.items[0].id.videoId,
          title: response.data.items[0].snippet.title,
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error("❌ Error searching YouTube:", error);
      return null;
    }
  }
}

module.exports = SearchService;
