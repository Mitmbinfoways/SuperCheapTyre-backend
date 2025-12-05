const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Tax = require("../Models/Tax.model");

const getAllTaxes = async (req, res) => {
    try {
        const { search, page, limit } = req.query;

        const filter = {};

        if (search) {
            filter.$or = [{ name: { $regex: search, $options: "i" } }];
        }

        // Base query
        let query = Tax.find(filter).sort({ createdAt: -1 });

        // If page & limit NOT provided → return FULL data
        if (!page || !limit) {
            const items = await query;
            const totalItems = await Tax.countDocuments(filter);

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        items,
                        pagination: null, // No pagination
                    },
                    "Taxes fetched successfully (all items)"
                )
            );
        }

        // Pagination logic (only when page & limit exist)
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const [items, totalItems] = await Promise.all([
            query.skip(skip).limit(limitNumber),
            Tax.countDocuments(filter),
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
                "Taxes fetched successfully"
            )
        );
    } catch (error) {
        console.error("getAllTaxes Error:", error);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

const createTax = async (req, res) => {
    try {
        const { name, percentage } = req.body;

        if (!percentage && percentage !== 0) {
            return res.status(400).json(new ApiError(400, "Tax percentage is required"));
        }

        const taxName = name || "GST";

        const existingTax = await Tax.findOne({ name: taxName });
        if (existingTax) {
            return res
                .status(400)
                .json(new ApiError(400, `Tax "${taxName}" already exists`));
        }

        const tax = await Tax.create({
            name: taxName,
            percentage,
        });

        return res
            .status(201)
            .json(new ApiResponse(201, tax, "Tax created successfully"));
    } catch (error) {
        console.error("createTax Error:", error);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

const getTaxById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json(new ApiError(400, "Invalid tax ID"));
        }

        const tax = await Tax.findById(id);
        if (!tax) {
            return res.status(404).json(new ApiError(404, "Tax not found"));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, tax, "Tax fetched successfully"));
    } catch (error) {
        console.error("getTaxById Error:", error);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

const updateTax = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json(new ApiError(400, "Invalid tax ID"));
        }

        const existing = await Tax.findById(id);
        if (!existing) {
            return res.status(404).json(new ApiError(404, "Tax not found"));
        }

        const { name, percentage } = req.body;

        if (name && name.trim() !== existing.name) {
            const nameExists = await Tax.findOne({
                name: name.trim(),
                _id: { $ne: id },
            });
            if (nameExists) {
                return res
                    .status(400)
                    .json(new ApiError(400, `Tax "${name}" already exists`));
            }
            existing.name = name.trim();
        }

        if (percentage !== undefined) {
            existing.percentage = percentage;
        }

        const updated = await existing.save();
        return res
            .status(200)
            .json(new ApiResponse(200, updated, "Tax updated successfully"));
    } catch (error) {
        console.error("updateTax Error:", error);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

const deleteTax = async (req, res) => {
    try {
        const id = req.params?.id;
        if (!id) {
            return res.status(400).json(new ApiError(400, "Tax id is required"));
        }

        const deleted = await Tax.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json(new ApiError(404, "Tax not found"));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, deleted, "Tax deleted successfully"));
    } catch (error) {
        console.log(error);
        return res.status(500).json(new ApiError(500, "Internal Server Error"));
    }
};

module.exports = {
    getAllTaxes,
    createTax,
    deleteTax,
    getTaxById,
    updateTax,
};
