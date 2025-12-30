const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Brand = require("../Models/Brand.model");

const getAllBrands = async (req, res) => {
  try {
    const { isActive, search, category, page, limit } = req.query;

    const filter = {};

    if (typeof isActive !== "undefined") {
      filter.isActive = isActive === "true";
    }

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }];
    }

    // Base query
    let query = Brand.find(filter).sort({ name: 1 });

    // If page & limit NOT provided → return FULL data
    if (!page || !limit) {
      const items = await query;
      const totalItems = await Brand.countDocuments(filter);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            items,
            pagination: null, // No pagination
          },
          "Brands fetched successfully (all items)"
        )
      );
    }

    // Pagination logic (only when page & limit exist)
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const [items, totalItems] = await Promise.all([
      query.skip(skip).limit(limitNumber),
      Brand.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limitNumber);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items,
          pagination: {
            totalItems,
            totalPages,
            currentPage: pageNumber,
            pageSize: limitNumber,
          },
        },
        "Brands fetched successfully"
      )
    );
  } catch (error) {
    console.error("getAllBrands Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const createBrand = async (req, res) => {
  try {
    const { name, category, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json(new ApiError(400, "Brand name is required"));
    }

    const existingBrand = await Brand.findOne({ name: name.trim() });
    if (existingBrand) {
      return res
        .status(400)
        .json(new ApiError(400, `Brand "${name}" already exists`));
    }

    const image = req.file ? req.file.filename : null;

    const brand = await Brand.create({
      name: name.trim(),
      category,
      image,
      isActive: isActive === "true" || isActive === true,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, brand, "Brand created successfully"));
  } catch (error) {
    console.error("createBrand Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(new ApiError(400, "Invalid brand ID"));
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

const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(new ApiError(400, "Invalid brand ID"));
    }

    const existing = await Brand.findById(id);
    if (!existing) {
      return res.status(404).json(new ApiError(404, "Brand not found"));
    }

    const { name, category, isActive } = req.body;

    if (name && name.trim() !== existing.name) {
      const nameExists = await Brand.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (nameExists) {
        return res
          .status(400)
          .json(new ApiError(400, `Brand "${name}" already exists`));
      }
      existing.name = name.trim();
    }

    if (category) existing.category = category;

    if (typeof isActive !== "undefined") {
      existing.isActive = isActive === "true" || isActive === true;
    }

    if (req.file) {
      if (existing.image) {
        const oldPath = path.join(
          __dirname,
          "../../public/Brand",
          existing.image
        );
        try {
          await fs.promises.unlink(oldPath);
        } catch (err) {
          console.log("Error deleting old brand image:", err.message);
        }
      }
      existing.image = req.file.filename;
    }

    const updated = await existing.save();
    return res
      .status(200)
      .json(new ApiResponse(200, updated, "Brand updated successfully"));
  } catch (error) {
    console.error("updateBrand Error:", error);
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
      const filePath = path.join(
        __dirname,
        "../../public/Brand",
        deleted.image
      );
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

module.exports = {
  getAllBrands,
  createBrand,
  deleteBrand,
  getBrandById,
  updateBrand,
};
