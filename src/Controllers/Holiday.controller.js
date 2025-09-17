const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Holiday = require("../Models/Holiday.model");

const createHoliday = async (req, res) => {
  try {
    const { id, date, reason, createdBy = "admin" } = req.body;

    if (!date) {
      return res.status(400).json(new ApiError(400, "date is required"));
    }

    const isoDate = new Date(date);
    if (isNaN(isoDate.getTime())) {
      return res.status(400).json(new ApiError(400, "Invalid date"));
    }

    if (id) {
      const exists = await Holiday.findById(id);
      if (!exists) {
        return res.status(404).json(new ApiError(404, "Holiday not found"));
      }

      const duplicate = await Holiday.findOne({
        _id: { $ne: id },
        date: isoDate,
      });
      if (duplicate) {
        return res
          .status(409)
          .json(new ApiError(409, "Holiday already exists for this date"));
      }

      exists.date = isoDate;
      if (reason) exists.reason = reason;
      exists.createdBy = createdBy;
      const updated = await exists.save();

      return res
        .status(200)
        .json(new ApiResponse(200, updated, "Holiday updated successfully"));
    }

    const exists = await Holiday.findOne({ date: isoDate });
    if (exists) {
      return res
        .status(409)
        .json(new ApiError(409, "Holiday already exists for this date"));
    }

    const created = await Holiday.create({ date: isoDate, reason, createdBy });
    return res
      .status(201)
      .json(new ApiResponse(201, created, "Holiday created"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const getHolidays = async (req, res) => {
  try {
    const { from, to, search, page, limit } = req.query;
    const filter = {};

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    if (search) {
      filter.reason = { $regex: search, $options: "i" };
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      const skip = (pageNumber - 1) * limitNumber;

      items = await Holiday.find(filter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(limitNumber);

      const totalItems = await Holiday.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limitNumber);

      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    } else {
      items = await Holiday.find(filter).sort({ date: 1 });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { items, pagination },
          "Holidays fetched successfully"
        )
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json(new ApiError(400, "id is required"));
    }

    const deleted = await Holiday.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json(new ApiError(404, "Holiday not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, deleted, "Holiday deleted successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = { createHoliday, getHolidays, deleteHoliday };
