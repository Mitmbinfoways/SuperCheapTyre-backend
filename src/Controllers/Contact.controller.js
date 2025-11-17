const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const ContactModel = require("../Models/Contact.model");
const sendMail = require("../Utils/Nodemailer");

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
      message: message || "",
      phone: phone || "",
    });

    const adminEmailSubject = "📩 New Contact Form Submission";
    const adminEmailHtml = `
      <h2>New Contact Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Message: ${message || "No message provided"}</strong></p>
    `;
    
    await sendMail(process.env.SMTP_USER, adminEmailSubject, adminEmailHtml);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          newContact,
          "Contact created and notification sent successfully"
        )
      );
  } catch (error) {
    console.error("Create contact error:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error while creating contact"));
  }
};

module.exports = {
  createContact,
  getAllContacts,
};
