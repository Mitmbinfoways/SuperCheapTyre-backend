const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");

// GET /appointments
const getAllAppointments = async (req, res) => {
  try {
    const { date, status, search, page, limit } = req.query;

    // Build filter dynamically
    const filter = {};
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
      ];
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      const skip = (pageNumber - 1) * limitNumber;

      items = await Appointment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      const totalItems = await Appointment.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limitNumber);

      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    } else {
      items = await Appointment.find(filter).sort({ createdAt: -1 });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { items, pagination },
          "Appointments fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// GET /appointments/slots?date=YYYY-MM-DD&timeSlotId=ID
const getAvailableSlots = async (req, res) => {
  try {
    const { date, timeSlotId } = req.query;

    if (!date) {
      return res.status(400).json(new ApiError(400, "Date is required"));
    }

    // Normalize date to YYYY-MM-DD
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    // Get time slot configuration
    let timeSlotConfig;
    if (timeSlotId) {
      timeSlotConfig = await TimeSlot.findById(timeSlotId);
    } else {
      timeSlotConfig = await TimeSlot.findOne({ isActive: true });
    }

    if (!timeSlotConfig) {
      return res
        .status(404)
        .json(new ApiError(404, "Time slot configuration not found"));
    }

    // Get booked appointments for this date
    const bookedAppointments = await Appointment.find({
      date: queryDate,
      status: { $in: ["reserved", "confirmed"] },
    });

    const bookedSlotIds = bookedAppointments.map((appt) => appt.slotId); // string

    // Map generated slots with availability
    const slots = timeSlotConfig.generatedSlots.map((slot) => ({
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: !slot.isBreak && !bookedSlotIds.includes(slot.slotId),
    }));

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { date: queryDate.toISOString().split("T")[0], slots },
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
        .json(new ApiError(400, "Date and slotId are required"));
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
      (slot) => slot.slotId === slotId
    );
    if (!validSlot) {
      return res
        .status(400)
        .json(new ApiError(400, "Invalid or break time slot selected"));
    }

    // Check if slot is already booked
    const already = await Appointment.findOne({
      date: appointmentDate,
      slotId: validSlot.slotId,
      status: { $in: ["reserved", "confirmed"] },
    });

    if (already) {
      return res
        .status(400)
        .json(new ApiError(400, "This slot is already booked"));
    }

    // Create appointment
    const created = await Appointment.create({
      firstname,
      lastname,
      phone,
      email,
      date: appointmentDate,
      slotId: validSlot.slotId, // ✅ store slotId string
      timeSlotId: timeSlotConfig._id,
      notes,
      status: status || "booked",
    });

    return res
      .status(201)
      .json(new ApiResponse(201, created, "Appointment created"));
  } catch (error) {
    console.error("Error creating appointment:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
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
      Employee,
    } = req.body;

    // Find existing appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json(new ApiError(404, "Appointment not found"));
    }

    // If updating date or slot, validate
    let appointmentDate = appointment.date;
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json(new ApiError(400, "Invalid date format"));
      }
      parsedDate.setHours(0, 0, 0, 0);
      appointmentDate = parsedDate;
    }

    let updatedSlotId = appointment.slotId;
    let updatedTimeSlotId = appointment.timeSlotId;

    if (slotId) {
      const timeSlotConfig = timeSlotId
        ? await TimeSlot.findById(timeSlotId)
        : await TimeSlot.findOne({ isActive: true });

      if (!timeSlotConfig) {
        return res
          .status(404)
          .json(new ApiError(404, "Time slot configuration not found"));
      }

      const validSlot = timeSlotConfig.generatedSlots.find(
        (slot) => String(slot._id) === String(slotId)
      );

      if (!validSlot || validSlot.isBreak) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid or break time slot selected"));
      }

      // Check if slot is already booked
      const already = await Appointment.findOne({
        _id: { $ne: id }, // exclude current appointment
        date: appointmentDate,
        slotId: validSlot._id,
        status: { $in: ["reserved", "confirmed"] },
      });

      if (already) {
        return res
          .status(400)
          .json(new ApiError(400, "This slot is already booked"));
      }

      updatedSlotId = validSlot._id;
      updatedTimeSlotId = timeSlotConfig._id;
    }

    // Update appointment
    appointment.firstname = firstname ?? appointment.firstname;
    appointment.lastname = lastname ?? appointment.lastname;
    appointment.phone = phone ?? appointment.phone;
    appointment.email = email ?? appointment.email;
    appointment.date = appointmentDate;
    appointment.slotId = updatedSlotId;
    appointment.timeSlotId = updatedTimeSlotId;
    appointment.status = status ?? appointment.status;
    appointment.notes = notes ?? appointment.notes;
    appointment.Employee = Employee ?? appointment.Employee;

    const updated = await appointment.save();

    return res
      .status(200)
      .json(new ApiResponse(200, updated, "Appointment updated successfully"));
  } catch (error) {
    console.error("Error in updateAppointment:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllAppointments,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
};
