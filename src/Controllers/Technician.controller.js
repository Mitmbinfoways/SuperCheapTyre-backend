const mongoose = require("mongoose");
const ApiError = require("../Utils/ApiError");
const TechnicianModel = require("../Models/Technician.model");
const ApiResponse = require("../Utils/ApiResponse");

const createTechnician = async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            null,
            "firstName, lastName, email, and phone are required"
          )
        );
    }

    const existingTechnician = await TechnicianModel.findOne({ email });

    if (existingTechnician && !existingTechnician.isDelete) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Email already exists"));
    }

    if (existingTechnician && existingTechnician.isDelete) {
      existingTechnician.firstName = firstName;
      existingTechnician.lastName = lastName;
      existingTechnician.phone = phone;
      existingTechnician.isDelete = false;
      existingTechnician.isActive = true;

      const restoredTechnician = await existingTechnician.save();
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            restoredTechnician,
            "Technician restored successfully"
          )
        );
    }

    const technician = new TechnicianModel({
      firstName,
      lastName,
      email,
      phone,
    });

    const savedTechnician = await technician.save();

    return res
      .status(201)
      .json(
        new ApiResponse(201, savedTechnician, "Technician created successfully")
      );
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

const getAllTechnician = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const filter = {};

    filter.isDelete = false;
    if (search && search.trim() !== "") {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const skip = (pageNumber - 1) * limitNumber;

      items = await TechnicianModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      const totalItems = await TechnicianModel.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limitNumber);

      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    } else {
      items = await TechnicianModel.find(filter).sort({ createdAt: -1 });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          pagination ? { items, pagination } : { items },
          "Technicians fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

const deleteTechnician = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json(new ApiError(400, "Invalid ID format"));
    }

    const technician = await TechnicianModel.findById(id);
    if (!technician) {
      return res.status(404).json(new ApiError(404, "Technician not found"));
    }
    technician.isDelete = true;
    await technician.save();

    res
      .status(200)
      .json(
        new ApiResponse(200, technician, "Technician soft deleted successfully")
      );
  } catch (error) {
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

const updateTechnician = async (req, res) => {
  try {
    const { id, firstName, lastName, email, phone, isActive } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json(new ApiError(400, "Invalid ID format"));
    }

    const technician = await TechnicianModel.findById(id);
    if (!technician) {
      return res.status(404).json(new ApiError(404, "Technician not found"));
    }

    if (email && email !== technician.email) {
      const existingTechnician = await TechnicianModel.findOne({ email });
      if (existingTechnician && existingTechnician._id.toString() !== id) {
        return res.status(400).json(new ApiError(400, "Email already exists"));
      }
    }

    if (firstName) technician.firstName = firstName;
    if (lastName) technician.lastName = lastName;
    if (email) technician.email = email;
    if (phone) technician.phone = phone;
    if (isActive !== undefined) technician.isActive = isActive;

    const updatedTechnician = await technician.save();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedTechnician,
          "Technician details updated successfully"
        )
      );
  } catch (error) {
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

module.exports = {
  createTechnician,
  getAllTechnician,
  updateTechnician,
  deleteTechnician,
};
