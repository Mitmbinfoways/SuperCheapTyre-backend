const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const MasterFilter = require("../Models/MasterFilter.model");

const createMasterFilter = async (req, res) => {
  try {
    const { category, subCategory, values } = req.body;

    if (!category || !subCategory || !values) {
      return res.status(400).json(new ApiError(400, "All fields are required"));
    }

    const existing = await MasterFilter.findOne({
      category,
      subCategory,
      values,
    });
    if (existing) {
      return res.status(400).json(new ApiError(400, "Filter already exists"));
    }

    const masterFilter = await MasterFilter.create({
      category,
      subCategory,
      values,
    });
    res
      .status(201)
      .json(
        new ApiResponse(201, masterFilter, "Master filter created successfully")
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllMasterFilters = async (req, res) => {
  try {
    const { search, category, page, limit, subCategory } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { category: { $regex: search, $options: "i" } },        
        { subCategory: { $regex: search, $options: "i" } },
        { values: { $regex: search, $options: "i" } },
      ];
    }

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;

    const total = await MasterFilter.countDocuments(query);

    let filtersQuery = MasterFilter.find(query).sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      filtersQuery = filtersQuery.skip(skip).limit(parseInt(limit));
    }

    const filters = await filtersQuery;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items: filters,
          pagination:
            page && limit
              ? {
                  total,
                  page: parseInt(page),
                  limit: parseInt(limit),
                  totalPages: Math.ceil(total / limit),
                }
              : null,
        },
        "Master filters fetched successfully"
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Internal server error"));
  }
};

const getMasterFilterById = async (req, res) => {
  try {
    const masterFilter = await MasterFilter.findById(req.params.id);
    if (!masterFilter) {
      return res.status(404).json(new ApiError(404, "Master filter not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, masterFilter, "Master filter fetched successfully")
      );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Internal server error"));
  }
};

const updateMasterFilter = async (req, res) => {
  try {
    const { category, subCategory, values } = req.body;

    if (!category || !subCategory || !values) {
      return res.status(400).json(new ApiError(400, "All fields are required"));
    }

    const masterFilter = await MasterFilter.findByIdAndUpdate(
      req.params.id,
      { category, subCategory, values },
      { new: true, runValidators: true }
    );

    if (!masterFilter) {
      return res.status(404).json(new ApiError(404, "Master filter not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, masterFilter, "Master filter updated successfully")
      );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Internal server error"));
  }
};

const deleteMasterFilter = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json(new ApiError(400, "Master filter id is required"));
    }

    const masterFilter = await MasterFilter.findByIdAndDelete(id);
    if (!masterFilter) {
      return res.status(404).json(new ApiError(404, "Master filter not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Master filter deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Internal server error"));
  }
};

module.exports = {
  createMasterFilter,
  getAllMasterFilters,
  getMasterFilterById,
  updateMasterFilter,
  deleteMasterFilter,
};
