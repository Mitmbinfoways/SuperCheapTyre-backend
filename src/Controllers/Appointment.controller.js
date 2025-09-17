const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");

// GET /appointments
const getAllAppointments = async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (status) filter.status = status;

    const items = await Appointment.find(filter).sort({ createdAt: -1 });
    return res
      .status(200)
      .json(new ApiResponse(200, items, "Appointments fetched successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// GET /appointments/slots?date=YYYY-MM-DD&timeSlotId=ID
const getAvailableSlots = async (req, res) => {
  try {
    const { date, timeSlotId } = req.query;

    // Validate date input
    if (!date) {
      return res.status(400).json(new ApiError(400, "Date is required"));
    }

    let queryDate;
    try {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json(new ApiError(400, "Invalid date format"));
      }
      // Format date to YYYY-MM-DD
      queryDate = parsedDate.toISOString().split("T")[0]; // e.g., "2025-09-16"
    } catch (error) {
      return res.status(400).json(new ApiError(400, "Invalid date format"));
    }

    // Log the query date for debugging
    console.log("Query Date:", queryDate);

    // Get time slot configuration
    let timeSlotConfig;
    if (timeSlotId) {
      timeSlotConfig = await TimeSlot.findById(timeSlotId);
      if (!timeSlotConfig) {
        return res
          .status(404)
          .json(new ApiError(404, "Time slot configuration not found"));
      }
    } else {
      timeSlotConfig = await TimeSlot.findOne({ isActive: true });
      if (!timeSlotConfig) {
        return res
          .status(404)
          .json(new ApiError(404, "No active time slot configuration found"));
      }
    }

    // Find booked appointments for the given date
    const bookedAppointments = await Appointment.find({
      date: queryDate,
    });

    // Log booked appointments for debugging
    console.log(
      "Booked Appointments:",
      JSON.stringify(bookedAppointments, null, 2)
    );

    // Extract booked slot IDs
    const bookedSlotIds = bookedAppointments.map((appointment) =>
      String(appointment.slotId)
    );

    // Log booked slot IDs for debugging
    console.log("Booked Slot IDs:", bookedSlotIds);

    // Map all slots with isAvailable field
    const slots = timeSlotConfig.generatedSlots.map((slot) => ({
      slotId: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: !slot.isBreak && !bookedSlotIds.includes(String(slot._id)),
    }));

    // Log all slots for debugging
    console.log("All Slots:", JSON.stringify(slots, null, 2));

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { date: queryDate, slots },
          "Slots retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error in getAvailableSlots:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// POST /appointments
const createAppointment = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      phone,
      email,
      date,
      slotId,
      status,
      timeSlotId,
      notes,
    } = req.body;

    if (!date || !slotId) {
      return res
        .status(400)
        .json(new ApiError(400, "date and slotId are required"));
    }

    // Normalize date to YYYY-MM-DD
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);

    // Get time slot configuration
    let timeSlotConfig;
    if (timeSlotId) {
      timeSlotConfig = await TimeSlot.findById(timeSlotId);
      if (!timeSlotConfig) {
        return res
          .status(404)
          .json(new ApiError(404, "Time slot configuration not found"));
      }
    } else {
      timeSlotConfig = await TimeSlot.findOne({ isActive: true });
      if (!timeSlotConfig) {
        return res
          .status(404)
          .json(new ApiError(404, "No active time slot configuration found"));
      }
    }

    // Validate slotId exists in generatedSlots
    const validSlot = timeSlotConfig.generatedSlots.find(
      (slot) => String(slot._id) === String(slotId)
    );

    if (!validSlot) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid or break time slot selected"));
    }

    // Check if slot is already booked
    const already = await Appointment.findOne({
      date: appointmentDate,
      slotId: validSlot._id,
      status: { $in: ["reserved", "confirmed"] },
    });

    if (already) {
      return res
        .status(409)
        .json(new ApiError(409, "This slot is already booked"));
    }

    // Create appointment
    const created = await Appointment.create({
      firstname,
      lastname,
      phone,
      email,
      date: appointmentDate,
      slotId: validSlot._id,
      timeSlotId: timeSlotConfig._id,
      notes,
      status: status || "booked",
    });

    return res
      .status(201)
      .json(new ApiResponse(201, created, "Appointment created"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllAppointments,
  getAvailableSlots,
  createAppointment,
};
