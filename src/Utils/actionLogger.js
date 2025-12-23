const logger = require("./logger");
const jwt = require("jsonwebtoken");

const actionLogger = async (req, res, next) => {
    const start = Date.now();

    let user = "Guest";

    // 1. Check Origin/Referer for "Admin" vs "User" context (if unauthenticated)
    const origin = req.headers.origin || req.headers.referer || "";
    if (origin.includes(":3000")) {
        user = "Admin";
    } else if (origin.includes(":4173") || origin.includes("frontend")) {
        user = "Frontend User";
    }

    // 2. Try to identify via Body (Login/Register payloads)
    if (req.body && req.body.email) {
        user = `${req.body.email} (Unverified)`;
    }

    // 3. Try to identify via JWT Token (Strongest Signal)
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            if (token) {
                const decoded = jwt.decode(token);
                if (decoded) {
                    const userId = decoded.id || decoded._id || decoded.userId || decoded.email;
                    if (userId) {
                        user = String(userId);
                    }
                }
            }
        }
    } catch (ignore) { }

    res.on("finish", () => {
        const duration = Date.now() - start;

        // 4. Final check: Did standard Auth middleware identify the user?
        if (req.user) user = String(req.user.id || req.user._id || req.user.email || req.user.username || user);
        if (req.admin) user = String(req.admin.id || req.admin._id || req.admin.email || user);

        if (user.includes("(Unverified)") && res.statusCode >= 200 && res.statusCode < 300) {
            user = user.replace(" (Unverified)", "");
        }

        logger.info(
            `METHOD=${req.method} URL=${req.originalUrl} STATUS=${res.statusCode} IP=${req.ip || req.connection.remoteAddress} TIME=${duration}ms USER=${user}`
        );
    });

    next();
};

module.exports = actionLogger;
