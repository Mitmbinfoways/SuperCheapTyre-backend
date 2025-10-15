const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const ContactModel = require("../Models/Contact.model");

const getAllContacts = async (req, res) => {
  try {
    let { search, page, limit } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const totalContacts = await ContactModel.countDocuments(filter);

    const contacts = await ContactModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalPages = Math.ceil(totalContacts / limit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items: contacts,
          pagination: {
            totalItems: totalContacts,
            totalPages,
            currentPage: page,
            pageSize: limit,
          },
        },
        "Contacts fetched successfully"
      )
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const createContact = async (req, res) => {
  try {
    const { name, email, message, phone } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json(new ApiError(400, "Name and email are required"));
    }

    const newContact = await ContactModel.create({
      name,
      email,
      message,
      phone,
    });

    const userEmailSubject = "Thank you for contacting us!";
    const userEmailHtml = `
      <h2>Hello ${name},</h2>
      <p>Thank you for reaching out to us. We have received your message and will get back to you soon.</p>
      <p><strong>Your Message:</strong></p>
      <p>${message || "No message provided"}</p>
      <br>
      <p>Best regards,<br>Your App Team</p>
    `;

    const adminEmailSubject = "New Contact Form Submission";
    const adminEmailHtml = `
      <h2>New Contact Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Message:</strong></p>
      <p>${message || "No message provided"}</p>
    `;

    Promise.all([
      sendMail(email, userEmailSubject, userEmailHtml),
      sendMail(
        process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        adminEmailSubject,
        adminEmailHtml
      ),
    ]).catch((error) => {
      console.error("Email sending failed:", error);
    });

    return res
      .status(201)
      .json(new ApiResponse(201, newContact, "Contact created successfully"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

module.exports = {
  createContact,
  getAllContacts,
};
