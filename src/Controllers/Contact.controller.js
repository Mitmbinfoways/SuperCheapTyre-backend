const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const ContactModel = require("../Models/Contact.model");

const getAllContacts = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.body;

    page = parseInt(page);
    limit = parseInt(limit);

    const totalContacts = await ContactModel.countDocuments();
    const contacts = await ContactModel.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          total: totalContacts,
          page,
          limit,
          contacts,
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
    const { name, email, message } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json(new ApiError(400, "Name and email are required"));
    }

    const newContact = await ContactModel.create({ name, email, message });

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