const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

const logDir = "logs";
const errorLogDir = path.join(logDir, "error");

const transport = new DailyRotateFile({
    filename: path.join(logDir, "supercheaptyre-%DATE%.log"),
    datePattern: "DD-MM-YYYY",
    maxFiles: "20d",        // keep logs for 14 days
    zippedArchive: true,
});

const errorTransport = new DailyRotateFile({
    filename: path.join(errorLogDir, "error-%DATE%.log"),
    datePattern: "DD-MM-YYYY",
    maxFiles: "15d",
    zippedArchive: true,
    level: "error", // Only store errors here
});

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
        winston.format.printf(
            (info) =>
                `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`
        )
    ),
    transports: [
        transport,
        errorTransport,
        new winston.transports.Console(), // optional: show in terminal
    ],
});

module.exports = logger;
