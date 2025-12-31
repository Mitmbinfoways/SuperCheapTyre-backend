const jwt = require("jsonwebtoken");
const ApiError = require("../Utils/ApiError");

const VerifyAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json(new ApiError(401, "Authorization header missing or invalid"));
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json(new ApiError(401, "Token missing"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded; // { id: ... }
        next();
    } catch (error) {
        return res.status(401).json(new ApiError(401, "Invalid or expired token"));
    }
};

module.exports = VerifyAdmin;
