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
