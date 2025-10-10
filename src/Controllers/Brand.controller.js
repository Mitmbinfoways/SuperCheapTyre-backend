const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Brand = require("../Models/Brand.model");
const fs = require("fs");
const path = require("path");

const getAllBrands = async (req, res) => {
  try {
    const { isActive, search, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (typeof isActive !== "undefined") filter.isActive = isActive === "true";

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
      ];
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      const skip = (pageNumber - 1) * limitNumber;

      items = await Brand.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      const totalItems = await Brand.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limitNumber);

      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    } else {
      items = await Brand.find(filter).sort({ createdAt: -1 });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { items, pagination },
          "Brands fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const createBrand = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    if (!name) {
      return res
        .status(400)
        .json(new ApiError(400, "Brand name is required"));
    }

    const existingBrand = await Brand.findOne({
      name: name.trim(),
    });

    if (existingBrand) {
      return res
        .status(400)
        .json(new ApiError(400, `Brand with name "${name}" already exists`));
    }

    // Handle uploaded image
    const image = req.file ? req.file.filename : null;

    const brand = await Brand.create({
      name,
      image,
      isActive,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, brand, "Brand created successfully"));
  } catch (error) {
    console.error("CreateBrand Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const getBrandById = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Brand id is required"));
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json(new ApiError(404, "Brand not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, brand, "Brand fetched successfully"));
  } catch (error) {
    console.error("getBrandById Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const deleteBrand = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Brand id is required"));
    }

    const deleted = await Brand.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json(new ApiError(404, "Brand not found"));
    }

    // Delete image file if exists
    if (deleted.image) {
      const filePath = path.join(__dirname, "../../public/Brand", deleted.image);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.log("Error deleting brand image:", err);
      }
    }

    return res
      .status(200)
      .json(new ApiResponse(200, deleted, "Brand deleted successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const updateBrand = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Brand id is required"));
    }

    const existing = await Brand.findById(id);
    if (!existing) {
      return res.status(404).json(new ApiError(404, "Brand not found"));
    }

    const { name, isActive } = req.body;

    // Check if name is being updated and if it already exists
    if (name && name !== existing.name) {
      const existingBrand = await Brand.findOne({
        name: name.trim(),
        _id: { $ne: id }, // Exclude current brand from search
      });

      if (existingBrand) {
        return res
          .status(400)
          .json(new ApiError(400, `Brand with name "${name}" already exists`));
      }
      
      existing.name = name;
    }

    if (typeof isActive !== "undefined")
      existing.isActive = isActive === true || isActive === "true";

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (existing.image) {
        const oldFilePath = path.join(__dirname, "../../public/Brand", existing.image);
        try {
          await fs.promises.unlink(oldFilePath);
        } catch (err) {
          console.log("Error deleting old brand image:", err);
        }
      }
      existing.image = req.file.filename;
    }

    const saved = await existing.save();
    return res
      .status(200)
      .json(new ApiResponse(200, saved, "Brand updated successfully"));
  } catch (error) {
    console.error("UpdateBrand Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllBrands,
  createBrand,
  deleteBrand,
  getBrandById,
  updateBrand,
};