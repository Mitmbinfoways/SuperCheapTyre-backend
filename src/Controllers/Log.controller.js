const path = require("path");
const fs = require("fs");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");
const logger = require("../Utils/logger");

const logDir = "logs";

// Get logs for a specific date or list all available log dates
const getLogs = async (req, res) => {
    try {
        const { date } = req.query; // Format: YYYY-MM-DD

        if (date) {
            // Read specific log file
            const filename = `supercheaptyre-${date}.log`;
            const filePath = path.join(path.resolve(), logDir, filename);

            if (!fs.existsSync(filePath)) {
                return res
                    .status(404)
                    .json(new ApiError(404, `No logs found for date: ${date}`));
            }

            // Read file content
            const content = fs.readFileSync(filePath, "utf-8");

            // Parse logs into an array of lines or objects if possible
            // Since format is: YYYY-MM-DD HH:mm:ss [LEVEL] message
            // We can just return the raw lines or split them
            const lines = content.split("\n").filter(line => line.trim() !== "");

            return res
                .status(200)
                .json(new ApiResponse(200, { date, logs: lines }, "Logs fetched successfully"));
        } else {
            // List all available log files
            if (!fs.existsSync(logDir)) {
                return res.status(200).json(new ApiResponse(200, [], "No logs directory found"));
            }

            const files = fs.readdirSync(logDir);
            // Filter for supercheaptyre-*.log and extract dates
            const logDates = files
                .filter(f => f.startsWith("supercheaptyre-") && f.endsWith(".log"))
                .map(f => f.replace("supercheaptyre-", "").replace(".log", ""));

            return res
                .status(200)
                .json(new ApiResponse(200, logDates, "Available log dates fetched successfully"));
        }
    } catch (error) {
        logger.error(`Error fetching logs: ${error.message}`);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

const createManualLog = async (req, res) => {
    try {
        const { message, level = 'info', action } = req.body;

        const logMessage = action ? `[MANUAL] Action=${action} | ${message}` : `[MANUAL] ${message}`;

        if (level === 'error') {
            logger.error(logMessage);
        } else if (level === 'warn') {
            logger.warn(logMessage);
        } else {
            logger.info(logMessage);
        }

        return res.status(200).json(new ApiResponse(200, null, "Log recorded"));
    } catch (error) {
        return res.status(500).json(new ApiError(500, "Error recording log"));
    }
}

module.exports = {
    getLogs,
    createManualLog
};
