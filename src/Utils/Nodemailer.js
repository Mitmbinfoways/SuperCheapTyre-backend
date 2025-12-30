const nodemailer = require("nodemailer");
const ApiError = require("./ApiError");

const sendMail = async (to, subject, htmlContent, attachments = [], cc = null) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Supercheap Tyres Dandenong" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
      attachments,
    };

    // Add CC if provided
    if (cc) {
      mailOptions.cc = cc;
    }

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    throw new ApiError(400, "Failed to send email");
  }
};

module.exports = sendMail;
