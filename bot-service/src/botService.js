const { Telegraf } = require("telegraf");
const Redis = require("ioredis");
const { Queue, Worker } = require("bullmq");
const sharedVolumePath = '/usr/src/app/shared';
const fs = require("fs");
const path = require("path");
const { generateDescription } = require("./spot");

class BotService {
  constructor(botToken, redisConfig) {
    this.bot = new Telegraf(botToken);
    this.redisQueue = new Queue("song-queries", {
      connection: redisConfig,
    });

    this.progressQu = new Queue("progress-updates", {
      connection: redisConfig,
    });

    this.redisClient = new Redis(redisConfig); // For rate limiting
    this.redisSub = new Redis(redisConfig); // For subscribing

    this.worker = new Worker("progress-updates", this.processJob.bind(this), {
      connection: redisConfig,
    });
  

    this.audioFilePath = path.join(__dirname, "test-audio.mp3"); // Placeholder for your audio file
    this.messageMap = new Map(); // To track message IDs for deletion
    this.initializeBot();
  }

  initializeBot() {
    // this.bot.use(this.rateLimiterMiddleware.bind(this));
    this.bot.start((ctx) =>
      ctx.reply(
        "Welcome! 🎶 Send a song name to receive the Instrumental version."
      )
    );
    this.bot.on("text", (ctx) => this.handleTextMessage(ctx));
    this.bot.on("callback_query", (ctx) => this.handleCallback(ctx));
    this.redisSub.subscribe("conversion-complete", (err, count) => {
      if (err) {
        console.error("Failed to subscribe: ", err.message);
      } else {
        console.log(`Subscribed to ${count} channel(s).`);
      }
    });

    this.redisSub.on("message", (channel, message) => {
      if(channel == "conversion-complete"){
      this.handleConversionComplete(channel, message);
      }
      else{
        ctx.reply("File limit exceeded !!!!")
      }
    });
  }

  async processJob(job) {
    await this.handleProgressUpdate(job.data);
  }

  async rateLimiterMiddleware(ctx, next) {
    const userId = ctx.from.id;
    const key = `rate_limit:${userId}`;
    const rateLimit = 4; // Number of allowed requests
    const expireTime = 60; // Time window in seconds

    const current = await this.redisClient.get(key);
    if (current && current >= rateLimit) {
      return ctx.reply("You have exceeded the rate limit. Please try again later.");
    }

    await this.redisClient.multi()
      .incr(key)
      .expire(key, expireTime)
      .exec();
     
      console.log("By Passed.....")

    return next();
  }

  async handleTextMessage(ctx) {
    try {
      const query =
        ctx.message.text.toLowerCase().replace(/\s+/g, "-") + "-instrumental";
      console.log("📩 Text Received:", query);

      await this.progressQu.add("submit-job", {
        userId: ctx.message.from.id,
        step: "receiving_query",
        progress: 0.2,
      });

      await this.redisQueue.add("submit-job", {
        userId: ctx.message.from.id,
        query,
        raw: ctx.message.text.toLowerCase(),
      });
    } catch (err) {
      console.error("Error handling text message:", err.message);
      await ctx.reply(
        "Sorry, there was an error processing your request. Please try again later."
      );
    }
  }

  async handleProgressUpdate(message) {
    const { userId, step, progress } = message;
    let progressMessage = "";
    let emoji = "";

    switch (step) {
      case "receiving_query":
        progressMessage = `🔄 Processing your request...`;
        emoji = "📥";
        break;
      case "searching_video":
        progressMessage = `🔍 Searching for your song...`;
        emoji = "🔎";
        break;
      case "downloading_video":
        progressMessage = `🎛️ Downloading and converting...This may take a while.`;
        emoji = "🎧";
        break;
      case "sending_audio":
        progressMessage = "✅ Sending your file...";
        emoji = "📤";
        break;
      default:
        progressMessage = "❓ File Greater than expected.";
        emoji = "❓";
        break;
    }

    try {
      const messageId = this.messageMap.get(userId);
      console.log("Came to Delete", this.messageMap);
      if (messageId) {
        try {
          await this.bot.telegram.deleteMessage(userId, messageId);
        } catch (err) {
          console.warn("Failed to delete previous message:", err.message);
        }
      }

      const newMessage = await this.bot.telegram.sendMessage(
        userId,
        `${emoji} ${progressMessage} (${Math.round(progress * 100)}%)`
      );
      this.messageMap.set(userId, newMessage.message_id);
      console.log("New Msg", this.messageMap, newMessage.text);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulated delay
    } catch (err) {
      console.error("Error sending progress update:", err);
      try {
        await this.bot.telegram.sendMessage(
          userId,
          "Sorry, there was an error updating the progress. Please try again later."
        );
      } catch (err) {
        console.error("Failed to send error message to user:", err.message);
      }
    }
  }

  async handleConversionComplete(channel, message) {
    const { userId, audioPath, raw } = JSON.parse(message);
    const rawQuery = raw;
    const fullAudioPath = path.join(sharedVolumePath, path.basename(audioPath));
    // const fullAudioPath = audioPath;
    try {
      console.log("✅ Conversion Received for User:", userId, fullAudioPath);
      await this.progressQu.add("submit-job", {
        userId,
        step: "sending_audio",
        progress: 0.98,
      });

      await this.bot.telegram.sendAudio(userId, { source: fullAudioPath });
      console.log(`🎵 Audio file sent to user ${userId} successfully`);
      console.log("Last Del", this.messageMap);
      const messageId = this.messageMap.get(userId);
      if (messageId) {
        try {
          await this.bot.telegram.deleteMessage(userId, messageId);
          this.messageMap.delete(userId);
        } catch (err) {
          console.warn("Failed to delete previous message:", err.message);
        }
      }

      // Send message with inline keyboard
      await this.bot.telegram.sendMessage(
        userId,
        "Would you like to know more about this song?",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Learn More",
                  callback_data: JSON.stringify({
                    action: "learn_more",
                    query: rawQuery,
                  }),
                },
              ],
              [
                {
                  text: "Skip",
                  callback_data: JSON.stringify({ action: "skip" }),
                },
              ],
            ],
          },
        }
      );
      // Clean up the audio file after sending
      this.cleanupFile(fullAudioPath);
    } catch (err) {
      console.error("Error sending audio file:", err);
      try {
        await this.bot.telegram.sendMessage(
          userId,
          "Sorry, there was an error sending the audio file. Please try again later."
        );
      } catch (err) {
        console.error("Failed to send error message to user:", err.message);
      }
    }
  }

  async handleCallback(ctx) {
    const callbackData = JSON.parse(ctx.callbackQuery.data);

    // Remove inline keyboard
    try {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [],
      });
    } catch (err) {
      console.error("Error removing inline keyboard:", err.message);
    }

    if (callbackData.action === "learn_more") {
      const rawQuery = callbackData.query;

      try {
        const geminiDescription = await generateDescription(rawQuery);
        if (geminiDescription === "Sorry") {
          await ctx.reply(
            "Sorry, I couldn’t find any details for that song 😔."
          );
        } else if (geminiDescription !== undefined) {
          await ctx.replyWithMarkdown(geminiDescription);
          await ctx.reply("Have a good day 🤗 !");
        } else {
          await ctx.reply("Limit's crossed 🤨!! Try after a minute !");
        }
      } catch (error) {
        console.error("Error fetching song details:", error.message);
        await ctx.reply(
          "There was an error fetching the song details. Please try again later 🙂."
        );
      }
    } else if (callbackData.action === "skip") {
      await ctx.reply("Okay, let me know if you need anything else!");
      await ctx.reply("Have a good day 🤗 !");
    }

    // Answer the callback query to remove the loading state on the button
    await ctx.answerCbQuery();
  }

  cleanupFile(filePath) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file ${filePath}:`, err);
      } else {
        console.log(`File ${filePath} deleted successfully.`);
      }
    });
  }

  startBot() {
    this.bot
      .launch()
      .then(() => {
        console.log("Bot is up and running");
      })
      .catch((err) => {
        console.error("Failed to launch bot:", err.message);
      });
  }
}

module.exports = BotService;
