"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToUtf8 = void 0;
const https_1 = require("firebase-functions/v2/https");
const functionsLogger = require("firebase-functions/logger");
const path = require("path");
const iconv = require("iconv-lite");
// Logger service following Financely pattern
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
 * This function accepts file content and converts the SQL file from its current
 * encoding to UTF-8, returning the converted content.
 *
 * Request payload structure:
 * {
 *   fileName: string,            // Name of the .sql file
 *   fileContent: string,         // Base64 encoded file content
 *   sourceEncoding?: string      // Optional encoding (auto-detects if not provided)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   originalFileName: string,
 *   convertedFileName: string,
 *   convertedContent: string,    // Base64 encoded converted content
 *   sourceEncoding: string,
 *   message: string
 * }
 *
 * @example
 * // Client call - auto-detects encoding
 * const convertToUtf8 = httpsCallable(functions, 'convertToUtf8');
 * const result = await convertToUtf8({
 *   fileName: "MobileOperator.sql",
 *   fileContent: "base64EncodedContent"
 * });
 * console.log("Converted file:", result.data.convertedFileName);
 *
 * // Or specify encoding manually
 * const result2 = await convertToUtf8({
 *   fileName: "MobileOperator.sql",
 *   fileContent: "base64EncodedContent",
 *   sourceEncoding: "windows-1251" // optional
 * });
 */
exports.convertToUtf8 = (0, https_1.onCall)({
    region: "us-central1",
    cors: true,
}, async (request) => {
    var _a;
    try {
        const { fileName, fileContent, sourceEncoding } = request.data;
        // Basic validation
        if (!fileName) {
            throw new https_1.HttpsError("invalid-argument", "File name is required");
        }
        if (!fileContent) {
            throw new https_1.HttpsError("invalid-argument", "File content is required");
        }
        if (!fileName.endsWith('.sql')) {
            throw new https_1.HttpsError("invalid-argument", "File must have .sql extension");
        }
        loggerService.info("Starting UTF-8 conversion", {
            fileName,
            sourceEncoding: sourceEncoding || "auto-detect",
            contentLength: fileContent.length,
        });
        // Generate output filename
        const parsedPath = path.parse(fileName);
        const convertedFileName = `${parsedPath.name}-utf8${parsedPath.ext}`;
        // Decode base64 content to buffer
        const buffer = Buffer.from(fileContent, 'base64');
        // Auto-detect encoding - comprehensive detection
        let detectedEncoding = sourceEncoding;
        if (!detectedEncoding) {
            // Comprehensive list of common encodings
            const encodingsToTry = [
                'utf8', 'utf-8',
                'windows-1251', 'cp1251',
                'windows-1252', 'cp1252',
                'iso-8859-1', 'latin1',
                'iso-8859-2', 'latin2',
                'iso-8859-5', 'cyrillic',
                'koi8-r', 'koi8-u',
                'cp866', 'ibm866',
                'cp850', 'ibm850',
                'macintosh', 'mac',
                'utf-16le', 'utf-16be',
                'utf-32le', 'utf-32be',
                'ascii'
            ];
            let bestEncoding = 'utf8';
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
                    }
                    else {
                        score -= replacementCharCount * 10; // Penalize replacement characters
                    }
                    // Check for valid text patterns
                    if (decoded.length > 0) {
                        score += 50; // Non-empty is good
                    }
                    // Check for SQL-like content (basic heuristic)
                    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'FROM', 'WHERE'];
                    const sqlKeywordCount = sqlKeywords.reduce((count, keyword) => {
                        return count + (decoded.toUpperCase().includes(keyword) ? 1 : 0);
                    }, 0);
                    score += sqlKeywordCount * 5; // SQL keywords are a good sign
                    // Check for reasonable character distribution
                    const printableChars = decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '').length;
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
                }
                catch (error) {
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
        // Encode as UTF-8 and convert to base64 for transmission
        const utf8Buffer = Buffer.from(decodedText, 'utf8');
        const convertedContent = utf8Buffer.toString('base64');
        loggerService.info("Conversion completed successfully", {
            originalFileName: fileName,
            convertedFileName: convertedFileName,
            sourceEncoding: detectedEncoding,
            originalSize: buffer.length,
            convertedSize: utf8Buffer.length,
        });
        return {
            success: true,
            originalFileName: fileName,
            convertedFileName: convertedFileName,
            convertedContent: convertedContent,
            sourceEncoding: detectedEncoding,
            message: `Successfully converted ${fileName} from ${detectedEncoding} to UTF-8`,
        };
    }
    catch (error) {
        loggerService.error("Failed to convert file to UTF-8", {
            error: error.message,
            stack: error.stack,
            fileName: (_a = request.data) === null || _a === void 0 ? void 0 : _a.fileName,
        });
        // Re-throw HttpsError as-is
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Wrap other errors
        throw new https_1.HttpsError("internal", `Failed to convert file to UTF-8: ${error.message}`);
    }
});
//# sourceMappingURL=covert-to-utf8.js.map