const jwt = require("jsonwebtoken");

const generateToken = (userData) => {
  const secretKey = process.env.JWT_SECRET;
  const payload = {
    userId: userData,
  };
  const token = jwt.sign(payload, secretKey, { expiresIn: "1d" });
  return token;
};

module.exports = { generateToken };
