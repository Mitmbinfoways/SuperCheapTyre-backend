const mongoose = require("mongoose");
const ApiError = require("../Utils/ApiError");
const TechnicianModel = require("../Models/Technician.model");
const ApiResponse = require("../Utils/ApiResponse");

// Create or Update a technician
const createTechnician = async (req, res) => {
  try {
    const { id, firstName, lastName, email, phone } = req.body; 

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

    if (id) {
      if (!mongoose.isValidObjectId(id)) {
        return res
          .status(400)
          .json(new ApiError(400, null, "Invalid ID format"));
      }

      const technician = await TechnicianModel.findById(id);
      if (!technician) {
        return res
          .status(404)
          .json(new ApiError(404, null, "Technician not found"));
      }

      if (email && email !== technician.email) {
        const existingTechnician = await TechnicianModel.findOne({ email });
        if (existingTechnician && existingTechnician._id.toString() !== id) {
          return res
            .status(400)
            .json(new ApiError(400, null, "Email already exists"));
        }
      }

      technician.firstName = firstName;
      technician.lastName = lastName;
      technician.email = email;
      technician.phone = phone;

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
    }

    const existingTechnician = await TechnicianModel.findOne({ email });
    if (existingTechnician) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Email already exists"));
    }

    const technician = new TechnicianModel({
      firstName,
      lastName,
      email,
      phone,
    });

    const savedTechnician = await technician.save();
    res
      .status(201)
      .json(
        new ApiResponse(201, savedTechnician, "Technician created successfully")
      );
  } catch (error) {
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

const getAllTechnician = async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const filter = {};

    if (search) {
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
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
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

    return res.status(200).json(
      new ApiResponse(
        200,
        { items, pagination },
        "Technicians fetched successfully"
      )
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

// Delete a technician
const deleteTechnician = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(new ApiError(400, null, "Invalid ID format"));
    }

    const technician = await TechnicianModel.findById(req.params.id);
    if (!technician) {
      return res
        .status(404)
        .json(new ApiError(404, null, "Technician not found"));
    }

    await TechnicianModel.deleteOne({ _id: req.params.id });
    res
      .status(200)
      .json(new ApiResponse(200, null, "Technician deleted successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, error.message || "Server error"));
  }
};

module.exports = {
  createTechnician,
  getAllTechnician,
  deleteTechnician,
};
