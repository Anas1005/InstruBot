// 

const Redis = require("ioredis");
const { Queue, Worker } = require("bullmq");
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = '/usr/local/bin/ffmpeg';
const ytDlpPath = '/usr/local/bin/yt-dlp';
const sharedVolumePath = '/usr/src/app/shared';

class ConverterService {
  constructor(redisConfig) {
    this.worker = new Worker("videos-to-convert", this.processJob.bind(this), {
      connection: redisConfig,
    });
    this.progressQu = new Queue("progress-updates", {
      connection: redisConfig,
    });
    this.publisher = new Redis(redisConfig);
    console.log("ConverterService initialized.");
  }

  async processJob(job) {
    await this.handleConversion(job.data);
  }

  async handleConversion({ userId, videoId, title, raw }) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const tempAudioBase = path.join(sharedVolumePath, `${title}-${videoId}`);
      const tempAudioPath = `${tempAudioBase}.mp3`;
      const outputPath = `${tempAudioBase}-compressed.mp3`;
      console.log(`Starting conversion for video ${title}, user ${userId}`);

      await this.progressQu.add("submit-job", {
        userId,
        step: "downloading_video",
        progress: 0.9,
      });

      const finalPath = await this.downloadAndConvertWithRetry(videoUrl, tempAudioPath, outputPath, userId);
      console.log("Final Path....", finalPath)

      // Notify bot service about conversion completion
      await this.publisher.publish(
        "conversion-complete",
        JSON.stringify({ userId, audioPath: finalPath, raw })
      );
      console.log(`Conversion complete for video ID ${videoId}, user ${userId}`);
    } catch (error) {
      console.error("Error in handleConversion:", error);
      // Optionally handle retries or error recovery logic here
    }
  }

  async downloadAndConvertWithRetry(videoUrl, tempAudioPath, outputPath, userId, retries = 3) {
    try {
     return await this.downloadAndConvert(videoUrl, tempAudioPath, outputPath, userId);
    } catch (error) {
      console.error("Error during conversion:", error);
      if (retries > 0) {
        console.log(`Retrying conversion, ${retries} attempts left...`);
       return await this.downloadAndConvertWithRetry(
          videoUrl,
          tempAudioPath,
          outputPath,
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

   downloadAndConvert(videoUrl, tempAudioPath, outputPath, userId){
    return new Promise((resolve, reject) => {
      console.log(`Downloading and converting video from URL: ${videoUrl}`);
      
      // Download video and extract audio
      const ytDlpProcess = spawn(ytDlpPath, [
        videoUrl,
        '--extract-audio',
        '--audio-format',
        'mp3',
        '--output',
        tempAudioPath,
        '--ffmpeg-location',
        ffmpegPath
      ]);

      ytDlpProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });

      ytDlpProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });

      ytDlpProcess.on('close', (code) => {
        if (code === 0) {
          fs.stat(tempAudioPath, async (err, stats) => {
            if (err) {
              console.error("Error getting file stats:", err);
              reject(err);
            } else {
              const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
              console.log(`File size: ${fileSizeMB} MB`);

              if (fileSizeMB > 3) {
                // Reduce file size
                const bitrate = '64k'; // Adjust bitrate as needed
                const ffmpegProcess = spawn(ffmpegPath, [
                  '-i', tempAudioPath,
                  '-b:a', bitrate,
                  outputPath
                ]);

                ffmpegProcess.stdout.on('data', (data) => {
                  console.log(`stdout: ${data}`);
                });

                ffmpegProcess.stderr.on('data', (data) => {
                  console.error(`stderr: ${data}`);
                });

                ffmpegProcess.on('close', (ffmpegCode) => {
                  if (ffmpegCode === 0) {
                    fs.unlink(tempAudioPath, (err) => {
                      if (err) {
                        console.error('Error deleting original file:', err);
                      }
                    });
                    resolve(outputPath);
                  } else {
                    console.error('FFmpeg compression failed');
                    reject(new Error('Compression failed'));
                  }
                });
              } else {
                console.log("It's < 3MB....")
                resolve(tempAudioPath);
              }
            }
          });
        } else {
          console.error('Video download failed');
          reject(new Error('Download failed'));
        }
      });
    });
  }
}

module.exports = ConverterService;
