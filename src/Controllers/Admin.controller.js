const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminModel = require("../Models/AdminUser.model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");
const sendMail = require("../Utils/Nodemailer");
const fs = require("fs");
const path = require("path");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRESIN = process.env.JWT_EXPIRESIN;

const RegiesterAdmin = async (req, res) => {
  try {
    const { name, password, phone, email } = req.body;
    const avatar = req.file ? req.file.filename : req.body?.avatar;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json(new ApiError(400, "Name, email and password are required"));
    }
    const existing = await AdminModel.findOne({ email });

    if (existing) {
      return res
        .status(400)
        .json(new ApiError(400, "Admin user is already exists"));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await AdminModel.create({
      name,
      password: hashedPassword,
      phone,
      avatar,
      email,
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, { newAdmin }, "Admin registered successfully")
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const AdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json(new ApiError(400, "Email and password are required"));
    }

    const emailLower = email.trim().toLowerCase();

    const admin = await AdminModel.findOne({ email: emailLower });
    if (!admin) {
      return res.status(404).json(new ApiError(404, "Invalid credentials"));
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json(new ApiError(400, "Invalid credentials"));
    }

    // Check if 2FA is enabled
    if (admin.twoFactorEnabled) {
      // Create a temporary token for 2FA verification (valid for 5 mins)
      const tempToken = jwt.sign(
        { id: admin._id, role: "admin_partial_auth" },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      return res.status(200).json(
        new ApiResponse(200, {
          requires2FA: true,
          tempToken: tempToken
        }, "2FA verification required")
      );
    }

    const token = jwt.sign({ id: admin._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRESIN,
    });

    admin.lastLogin = new Date();
    await admin.save();

    return res
      .status(200)
      .json(new ApiResponse(200, { token, admin }, "Login successful"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const RequestReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(new ApiError(400, "Email is required"));
    }

    const admin = await AdminModel.findOne({ email });
    if (!admin) {
      return res.status(404).json(new ApiError(404, "Admin not found"));
    }

    const resetToken = jwt.sign({ id: admin._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const resetLink = `${process.env.ADMIN_URL}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
    `;

    await sendMail(admin.email, "Password Reset Request", htmlContent);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Password reset email sent"));
  } catch (error) {
    console.error("RequestReset error:", error);
    return res.status(500).json(new ApiError(500, "Server error"));
  }
};

const GetAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminModel.findById(id);
    if (!admin) {
      return res.status(404).json(new ApiError(404, "Admin not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, admin, "Admin fetched successfully"));
  } catch (error) {
    console.error("getAdminById Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const ForgotPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json(new ApiError(400, "Token and new password are required"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid or expired token"));
    }

    const admin = await AdminModel.findById(decoded.id);
    if (!admin) {
      return res.status(404).json(new ApiError(404, "Admin not found"));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Password reset successfully"));
  } catch (error) {
    console.error("ForgotPassword Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const UpdateProfile = async (req, res) => {
  try {
    const { id, email, name, phone, oldPassword, newPassword } = req.body;
    const newAvatar = req.file ? req.file.filename : null; // new uploaded file

    const admin = await AdminModel.findById(id);
    if (!admin) {
      return res.status(404).json(new ApiError(404, "Admin not found"));
    }

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (phone) admin.phone = phone;

    // Handle avatar update and delete old file
    if (newAvatar) {
      if (admin.avatar) {
        // Delete old file
        const oldPath = path.join(
          __dirname,
          "../../public/AdminProfile",
          admin.avatar
        );
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      admin.avatar = newAvatar; // set new avatar
    }

    // Handle password update
    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, admin.password);
      if (!isMatch) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Old password is incorrect. Please enter correct password"
            )
          );
      }
      admin.password = await bcrypt.hash(newPassword, 10);
    } else if (oldPassword || newPassword) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Both old and new passwords are required to change password"
          )
        );
    }

    await admin.save();

    return res
      .status(200)
      .json(new ApiResponse(200, admin, "Profile updated successfully"));
  } catch (error) {
    console.error("UpdateProfile Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// 2FA Controllers

const Setup2FA = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const admin = await AdminModel.findById(adminId);

    if (!admin) return res.status(404).json(new ApiError(404, "Admin not found"));

    const secret = speakeasy.generateSecret({
      name: `SuperCheapTyre Admin (${admin.email})`,
    });

    admin.twoFactorSecret = secret.base32;
    await admin.save();

    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json(new ApiError(500, "Error generating QR code"));

      return res.status(200).json(new ApiResponse(200, {
        secret: secret.base32,
        qrCode: data_url
      }, "2FA Setup initialized"));
    });

  } catch (error) {
    console.error("Setup2FA Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const Verify2FASetup = async (req, res) => {
  try {
    const { token } = req.body;
    const adminId = req.admin.id;

    const admin = await AdminModel.findById(adminId).select("+twoFactorSecret");
    if (!admin) return res.status(404).json(new ApiError(404, "Admin not found"));

    // 1. Try TOTP (Time-based)
    let verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token: token,
    });

    // 2. Try HOTP (Counter-based) - Initial setup always checks counter 0
    let isHotp = false;
    if (!verified) {
      verified = speakeasy.hotp.verify({
        secret: admin.twoFactorSecret,
        encoding: "base32",
        token: token,
        counter: 0
      });
      if (verified) isHotp = true;
    }

    if (verified) {
      admin.twoFactorEnabled = true;
      const backupCodes = Array.from({ length: 10 }, () =>
        Math.floor(100000 + Math.random() * 900000).toString()
      );
      admin.twoFactorBackupCodes = backupCodes;

      // If HOTP was used, initialize counter to 1 (since 0 was used)
      // If TOTP was used, we can still init counter to 0 or 1, doesn't matter much for TOTP
      if (isHotp) {
        admin.twoFactorCounter = 1;
      } else {
        admin.twoFactorCounter = 0;
      }

      const htmlContent = `
        <h1>Admin 2FA Secret key</h1>
        <p>Here is your 2FA Secret key: ${admin.twoFactorSecret}</p>
        <p>Keep it safe and secure. You can use it to enable 2FA on your account.</p>
      `;

      await sendMail(process.env.SMTP_USER, "Admin 2FA Secret key", htmlContent)

      await admin.save();

      return res.status(200).json(new ApiResponse(200, { backupCodes }, "2FA Enabled Successfully"));
    } else {
      return res.status(400).json(new ApiError(400, "Invalid Token"));
    }
  } catch (error) {
    console.error("Verify2FASetup Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const Verify2FALogin = async (req, res) => {
  try {
    const { tempToken, token } = req.body;

    if (!tempToken || !token) {
      return res.status(400).json(new ApiError(400, "Token and OTP required"));
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
      if (decoded.role !== "admin_partial_auth") throw new Error("Invalid token type");
    } catch (e) {
      return res.status(401).json(new ApiError(401, "Invalid or expired session"));
    }

    const admin = await AdminModel.findById(decoded.id).select("+twoFactorSecret +twoFactorBackupCodes +twoFactorCounter");
    if (!admin) return res.status(404).json(new ApiError(404, "Admin not found"));

    // 1. Try TOTP
    let verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token: token,
      window: 1
    });

    // 2. Try HOTP if TOTP failed
    if (!verified) {
      const currentCounter = admin.twoFactorCounter || 0;
      const lookaheadWindow = 20; // Check next 20 codes in case user pressed button multiple times

      for (let i = 0; i <= lookaheadWindow; i++) {
        const checkCounter = currentCounter + i;
        const hotpVerified = speakeasy.hotp.verify({
          secret: admin.twoFactorSecret,
          encoding: "base32",
          token: token,
          counter: checkCounter
        });

        if (hotpVerified) {
          verified = true;
          // Update counter to next value (current match + 1)
          admin.twoFactorCounter = checkCounter + 1;
          await admin.save();
          break;
        }
      }
    }

    let isBackupCode = false;
    if (!verified) {
      const codeIndex = admin.twoFactorBackupCodes.indexOf(token);
      if (codeIndex > -1) {
        isBackupCode = true;
        admin.twoFactorBackupCodes.splice(codeIndex, 1);
        await admin.save();
      } else {
        return res.status(400).json(new ApiError(400, "Invalid 2FA Code"));
      }
    }

    const accessToken = jwt.sign({ id: admin._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRESIN,
    });

    admin.lastLogin = new Date();
    await admin.save();

    return res.status(200).json(new ApiResponse(200, {
      token: accessToken,
      admin,
    }, isBackupCode ? "Logged in with backup code" : "Logged in successfully"));

  } catch (error) {
    console.error("Verify2FALogin Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const Disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    const adminId = req.admin.id;

    const admin = await AdminModel.findById(adminId).select("+password");

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json(new ApiError(400, "Incorrect password"));

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = undefined;
    admin.twoFactorBackupCodes = undefined;
    await admin.save();

    return res.status(200).json(new ApiResponse(200, null, "2FA Disabled"));

  } catch (error) {
    console.error("Disable2FA Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  RegiesterAdmin,
  AdminLogin,
  RequestReset,
  GetAdminById,
  ForgotPassword,
  UpdateProfile,
  Setup2FA,
  Verify2FASetup,
  Verify2FALogin,
  Disable2FA,
};
