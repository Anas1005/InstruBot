const Redis = require("ioredis");
const { Queue, Worker } = require("bullmq");
const fs = require("fs");
const ytdl = require("ytdl-core");
const sharedVolumePath = '/usr/src/app/shared';
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

class ConverterService {
  constructor(redisConfig) {
    this.worker = new Worker("videos-to-convert", this.processJob.bind(this), {
      connection: redisConfig,
    });
    this.progressQu = new Queue("progress-updates", {
      connection: redisConfig,
    });
    this.publisher = new Redis(redisConfig);
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log("ConverterService initialized.");
  }

  async processJob(job) {
    await this.handleConversion(job.data);
  }

  async handleConversion({ userId, videoId, title, raw }) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      // const audioPath = path.join(__dirname, `${title}-${videoId}.mp3`);
      const audioPath = path.join(sharedVolumePath, `${title}-${videoId}.mp3`)
      console.log(`Starting conversion for video ${title}, user ${userId}`);
      await this.progressQu.add("submit-job", {
        userId,
        step: "downloading_video",
        progress: 0.9,
      });

      await this.downloadAndConvertWithRetry(videoUrl, audioPath, userId);

      // Notify bot service about conversion completion
      await this.publisher.publish(
        "conversion-complete",
        JSON.stringify({ userId, audioPath, raw })
      );
      console.log(
        `Conversion complete for video ID ${videoId}, user ${userId}`
      );
    } catch (error) {
      console.error("Error in handleConversion:", error);
      // Optionally handle retries or error recovery logic here
    }
  }

  async downloadAndConvertWithRetry(videoUrl, audioPath, userId, retries = 3) {
    try {
      await this.downloadAndConvert(videoUrl, audioPath, userId);
    } catch (error) {
      console.error("Error during conversion:", error);
      if (retries > 0) {
        console.log(`Retrying conversion, ${retries} attempts left...`);
        await this.downloadAndConvertWithRetry(
          videoUrl,
          audioPath,
          userId,
          retries - 1
        );
      } else {
        console.error("Maximum retries exceeded. Unable to convert video.");
        // Optionally handle error state or notify admin
        throw error; // Rethrow the error to propagate it up
      }
    }
  }

  async downloadAndConvert(videoUrl, audioPath, userId) {
    return new Promise((resolve, reject) => {
      console.log(`Downloading and converting video from URL: ${videoUrl}`);
      const stream = ytdl(videoUrl, { quality: "highestaudio" });

      ffmpeg(stream)
        .audioBitrate(48)   // Further reduce the bitrate
        .save(audioPath)
        .on("end", async () => {
          console.log(`Conversion finished, saved to ${audioPath}`);
          fs.stat(audioPath, async (err, stats) => {
            if (err) {
              console.error("Error getting file stats:", err);
              reject(err);
            } else {
              const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
              console.log(`File size: ${fileSizeMB} MB`);

              if (fileSizeMB > 3) {
                console.log("File size exceeded 3MB, terminating process.");
                await this.publisher.publish(
                  "conversion-exceed",
                  JSON.stringify({ userId, message: "File size exceeded 3MB" })
                );
                fs.unlink(audioPath, (err) => {
                  if (err) {
                    console.error("Error deleting large file:", err);
                  } else {
                    console.log("Deleted large file successfully.");
                  }
                });
                reject(new Error("File size exceeded 3MB"));
              } else {
                resolve(audioPath);
              }
            }
          });
        })
        .on("error", (error) => {
          console.error("Error during conversion:", error);
          reject(error);
        });
    });
  }
}

module.exports = ConverterService;
