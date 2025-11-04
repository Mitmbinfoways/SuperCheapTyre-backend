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
          .status(400)
          .json(new ApiError(400, "Holiday already exists for this date"));
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
        .status(400)
        .json(new ApiError(400, "Holiday already exists for this date"));
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
    const { search, page, limit } = req.query;
    const filter = {};

    if (search) {
      const fullDateRegex = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
      const dayMonthRegex = /^(\d{2})[-/](\d{2})$/;
      const dayRegex = /^(\d{2})$/;

      if (fullDateRegex.test(search)) {
        const [_, day, month, year] = search.match(fullDateRegex);
        const parsedDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        if (isNaN(parsedDate)) {
          return res.status(400).json(new ApiError(400, "Invalid date format"));
        }

        const startDate = new Date(parsedDate);
        const endDate = new Date(parsedDate);
        endDate.setDate(startDate.getDate() + 1);

        filter.date = { $gte: startDate, $lt: endDate };
      } else if (dayMonthRegex.test(search)) {
        const [_, day, month] = search.match(dayMonthRegex);
        // Validate day and month
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
          return res
            .status(400)
            .json(new ApiError(400, "Invalid day or month"));
        }

        // Use aggregation to match day and month
        filter.$expr = {
          $and: [
            { $eq: [{ $dayOfMonth: "$date" }, dayNum] },
            { $eq: [{ $month: "$date" }, monthNum] },
          ],
        };
      } else if (dayRegex.test(search)) {
        const dayNum = parseInt(search, 10);
        if (dayNum < 1 || dayNum > 31) {
          return res.status(400).json(new ApiError(400, "Invalid day"));
        }

        // Use aggregation to match day
        filter.$expr = { $eq: [{ $dayOfMonth: "$date" }, dayNum] };
      } else {
        filter.reason = { $regex: search, $options: "i" };
      }
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      if (
        isNaN(pageNumber) ||
        isNaN(limitNumber) ||
        pageNumber < 1 ||
        limitNumber < 1
      ) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid page or limit parameters"));
      }

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
    console.error(error);
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
