const {onCall, HttpsError} = require("firebase-functions/v2/https");
const functionsLogger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

// Logger service
const loggerService = {
  info(...args) {
    functionsLogger.info(...args);
  },
  warn(...args) {
    functionsLogger.warn(...args);
  },
  error(...args) {
    functionsLogger.error(...args);
  },
  debug(...args) {
    functionsLogger.debug(...args);
  },
};

/**
 * Firebase Cloud Function for converting SQL files to UTF-8 encoding.
 *
 * This function accepts a file path and converts the SQL file from its current
 * encoding to UTF-8, saving it with a "-utf8" suffix.
 *
 * Request payload structure:
 * {
 *   filePath: string,           // Name of the .sql file to convert
 *   fileContent: string,        // Base64 encoded file content
 *   sourceEncoding?: string     // Optional encoding (auto-detects if not provided)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   originalPath: string,
 *   convertedPath: string,
 *   sourceEncoding: string,
 *   message: string
 * }
 */
exports.convertToUtf8 = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const {filePath, fileContent, sourceEncoding} = request.data;

      // Basic validation
      if (!filePath) {
        throw new HttpsError(
          "invalid-argument",
          "File path is required"
        );
      }

      if (!fileContent) {
        throw new HttpsError(
          "invalid-argument",
          "File content is required"
        );
      }

      if (!filePath.endsWith(".sql")) {
        throw new HttpsError(
          "invalid-argument",
          "File must have .sql extension"
        );
      }

      loggerService.info("Starting UTF-8 conversion", {
        filePath,
        sourceEncoding: sourceEncoding || "auto-detect",
      });

      // Generate output path
      const parsedPath = path.parse(filePath);
      const outputPath = `${parsedPath.name}-utf8${parsedPath.ext}`;

      // Decode base64 content to buffer
      const buffer = Buffer.from(fileContent, 'base64');

      // Auto-detect encoding - comprehensive detection
      let detectedEncoding = sourceEncoding;
      if (!detectedEncoding) {
        // Comprehensive list of common encodings
        const encodingsToTry = [
          "utf8", "utf-8",
          "windows-1251", "cp1251",
          "windows-1252", "cp1252",
          "iso-8859-1", "latin1",
          "iso-8859-2", "latin2",
          "iso-8859-5", "cyrillic",
          "koi8-r", "koi8-u",
          "cp866", "ibm866",
          "cp850", "ibm850",
          "macintosh", "mac",
          "utf-16le", "utf-16be",
          "utf-32le", "utf-32be",
          "ascii"
        ];

        let bestEncoding = "utf8";
        let bestScore = 0;

        for (const encoding of encodingsToTry) {
          try {
            const decoded = iconv.decode(buffer, encoding);

            // Calculate a score for this encoding
            let score = 0;

            // Check for replacement characters (bad sign)
            const replacementCharCount = (decoded.match(/\uFFFD/g) || []).length;
            if (replacementCharCount === 0) {
              score += 100; // No replacement characters is very good
            } else {
              score -= replacementCharCount * 10; // Penalize replacement characters
            }

            // Check for valid text patterns
            if (decoded.length > 0) {
              score += 50; // Non-empty is good
            }

            // Check for SQL-like content (basic heuristic)
            const sqlKeywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TABLE", "FROM", "WHERE"];
            const sqlKeywordCount = sqlKeywords.reduce((count, keyword) => {
              return count + (decoded.toUpperCase().includes(keyword) ? 1 : 0);
            }, 0);
            score += sqlKeywordCount * 5; // SQL keywords are a good sign

            // Check for reasonable character distribution
            const printableChars = decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, "").length;
            const printableRatio = printableChars / decoded.length;
            if (printableRatio > 0.8) {
              score += 30; // High ratio of printable characters is good
            }

            // Check for common SQL characters
            const sqlChars = /[;(),'"]/g;
            const sqlCharCount = (decoded.match(sqlChars) || []).length;
            score += Math.min(sqlCharCount, 20); // SQL characters are good indicators

            loggerService.debug("Encoding detection attempt", {
              encoding,
              score,
              length: decoded.length,
              replacementChars: replacementCharCount,
              sqlKeywords: sqlKeywordCount,
              printableRatio: printableRatio.toFixed(2)
            });

            if (score > bestScore) {
              bestScore = score;
              bestEncoding = encoding;
            }
          } catch (error) {
            // Continue to next encoding
            continue;
          }
        }

        detectedEncoding = bestEncoding;

        loggerService.info("Encoding auto-detection completed", {
          detectedEncoding,
          confidenceScore: bestScore,
          totalEncodingsTested: encodingsToTry.length
        });
      }

      loggerService.info("Encoding detection", {
        detectedEncoding,
        fileSize: buffer.length,
      });

      // Decode from source encoding
      const decodedText = iconv.decode(buffer, detectedEncoding);

      // Convert to base64 for transmission back to client
      const utf8Buffer = Buffer.from(decodedText, 'utf8');
      const base64Content = utf8Buffer.toString('base64');

      loggerService.info("Conversion completed successfully", {
        originalPath: filePath,
        convertedPath: outputPath,
        sourceEncoding: detectedEncoding,
        originalSize: buffer.length,
        convertedSize: utf8Buffer.length,
      });

      return {
        success: true,
        originalPath: filePath,
        convertedPath: outputPath,
        convertedContent: base64Content,
        sourceEncoding: detectedEncoding,
        message: `Successfully converted ${filePath} from ${detectedEncoding} to UTF-8`,
      };
    } catch (error) {
      loggerService.error("Failed to convert file to UTF-8", {
        error: error.message,
        stack: error.stack,
        filePath: request.data && request.data.filePath,
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to convert file to UTF-8: ${error.message}`
      );
    }
  }
);
