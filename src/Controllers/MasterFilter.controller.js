const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const MasterFilter = require("../Models/MasterFilter.model");

const getAllMasterFilters = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { "tyres.pattern.name": { $regex: search, $options: "i" } },
        { "tyres.width.name": { $regex: search, $options: "i" } },
        { "tyres.profile.name": { $regex: search, $options: "i" } },
        { "tyres.diameter.name": { $regex: search, $options: "i" } },
        { "tyres.loadRating.name": { $regex: search, $options: "i" } },
        { "tyres.speedRating.name": { $regex: search, $options: "i" } },
        { "wheels.size.name": { $regex: search, $options: "i" } },
        { "wheels.color.name": { $regex: search, $options: "i" } },
        { "wheels.diameter.name": { $regex: search, $options: "i" } },
        { "wheels.fitments.name": { $regex: search, $options: "i" } },
        { "wheels.staggeredOptions.name": { $regex: search, $options: "i" } },
      ];
    }

    const items = await MasterFilter.find(filter).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, items, "Master filters fetched successfully"));
  } catch (error) {
    console.error("GetAllMasterFilters Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const updateMasterFilter = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res
        .status(400)
        .json(new ApiError(400, "Master filter ID is required"));
    }

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid Master filter ID"));
    }

    const existing = await MasterFilter.findById(id);
    if (!existing) {
      return res.status(404).json(new ApiError(404, "Master filter not found"));
    }

    const { tyres, wheels } = req.body;

    if (!tyres && !wheels) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "At least one of tyres or wheels must be provided for update"
          )
        );
    }

    // Helper to merge options (avoid duplicates)
    const mergeOptions = (existingArray = [], newArray = []) => {
      const existingNames = new Set(
        existingArray.map((opt) => opt.name.toLowerCase().trim())
      );
      const merged = [
        ...existingArray,
        ...newArray.filter(
          (opt) => opt.name && !existingNames.has(opt.name.toLowerCase().trim())
        ),
      ];
      return merged;
    };

    // --- Update tyres ---
    if (tyres) {
      const tyreFields = [
        "pattern",
        "width",
        "profile",
        "diameter",
        "loadRating",
        "speedRating",
      ];

      for (const field of tyreFields) {
        if (tyres[field]) {
          if (!Array.isArray(tyres[field])) {
            return res
              .status(400)
              .json(new ApiError(400, `Tyres ${field} must be an array`));
          }

          // Validate each option has name
          for (const option of tyres[field]) {
            if (!option.name) {
              return res
                .status(400)
                .json(
                  new ApiError(
                    400,
                    `Name is required for each ${field} option in tyres`
                  )
                );
            }
          }

          existing.tyres[field] = mergeOptions(
            existing.tyres[field],
            tyres[field]
          );
        }
      }
    }

    // --- Update wheels ---
    if (wheels) {
      const wheelFields = [
        "size",
        "color",
        "diameter",
        "fitments",
        "staggeredOptions",
      ];

      for (const field of wheelFields) {
        if (wheels[field]) {
          if (!Array.isArray(wheels[field])) {
            return res
              .status(400)
              .json(new ApiError(400, `Wheels ${field} must be an array`));
          }

          for (const option of wheels[field]) {
            if (!option.name) {
              return res
                .status(400)
                .json(
                  new ApiError(
                    400,
                    `Name is required for each ${field} option in wheels`
                  )
                );
            }
          }

          existing.wheels[field] = mergeOptions(
            existing.wheels[field],
            wheels[field]
          );
        }
      }
    }

    const saved = await existing.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          saved,
          "Master filter updated successfully (options merged)"
        )
      );
  } catch (error) {
    console.error("UpdateMasterFilter Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const deleteMasterFilter = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, field, optionId } = req.body;

    if (!id || !category || !field || !optionId) {
      return res
        .status(400)
        .json(
          new ApiError(400, "id, category, field, and optionId are required")
        );
    }

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(optionId)) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid Master filter or Option ID format"));
    }

    // Build dynamic path for the array field to update
    const path = `${category}.${field}`;

    // Check if MasterFilter exists
    const existing = await MasterFilter.findById(id);
    if (!existing) {
      return res.status(404).json(new ApiError(404, "Master filter not found"));
    }

    // Use MongoDB $pull operator to remove the object by its _id
    const updated = await MasterFilter.findByIdAndUpdate(
      id,
      { $pull: { [path]: { _id: optionId } } },
      { new: true }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updated,
          `Option deleted successfully from ${category}.${field}`
        )
      );
  } catch (error) {
    console.error("DeleteMasterFilterOption Error:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Internal Server Error", error.message));
  }
};

module.exports = {
  getAllMasterFilters,
  updateMasterFilter,
  deleteMasterFilter,
};
