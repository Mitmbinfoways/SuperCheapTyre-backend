const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const ContactInfoModel = require("../Models/ContactInfo.model");

const createContactInfo = async (req, res) => {
  try {
    const { phone, email, address, openingHours, openingHoursNote, mapLocation } = req.body;

    // Check if contact info already exists (Singleton pattern)
    const existingContactInfo = await ContactInfoModel.findOne();
    if (existingContactInfo) {
      return res
        .status(400)
        .json(new ApiError(400, "Contact Info already exists. Please update the existing one."));
    }

    const newContactInfo = await ContactInfoModel.create({
      phone,
      email,
      address,
      openingHours,
      openingHoursNote,
      mapLocation,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, newContactInfo, "Contact Info created successfully"));
  } catch (error) {
    console.error("Create Contact Info error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const getContactInfo = async (req, res) => {
  try {
    const contactInfo = await ContactInfoModel.findOne();

    if (!contactInfo) {
      return res.status(404).json(new ApiError(404, "Contact Info not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, contactInfo, "Contact Info fetched successfully"));
  } catch (error) {
    console.error("Get Contact Info error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const updateContactInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedContactInfo = await ContactInfoModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedContactInfo) {
      return res.status(404).json(new ApiError(404, "Contact Info not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updatedContactInfo, "Contact Info updated successfully"));
  } catch (error) {
    console.error("Update Contact Info error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

const deleteContactInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContactInfo = await ContactInfoModel.findByIdAndDelete(id);

    if (!deletedContactInfo) {
      return res.status(404).json(new ApiError(404, "Contact Info not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Contact Info deleted successfully"));
  } catch (error) {
    console.error("Delete Contact Info error:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

module.exports = {
  createContactInfo,
  getContactInfo,
  updateContactInfo,
  deleteContactInfo,
};
