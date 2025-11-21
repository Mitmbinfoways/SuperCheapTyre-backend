const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");
const Technician = require("../Models/Technician.model");

const getAllAppointments = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { firstname: searchRegex },
        { lastname: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { notes: searchRegex },
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const appointments = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const technicianIds = [
      ...new Set(appointments.map((a) => a.Employee).filter((id) => !!id)),
    ];

    const technicians = await Technician.find({
      _id: { $in: technicianIds },
    })
      .select("firstName lastName email phone isActive isDelete")
      .lean();

    const technicianMap = {};
    for (const tech of technicians) {
      technicianMap[tech._id.toString()] = tech;
    }

    const timeSlotIds = [...new Set(appointments.map((a) => a.timeSlotId))];
    const timeSlots = await TimeSlot.find({ _id: { $in: timeSlotIds } }).lean();

    const timeSlotMap = {};
    for (const ts of timeSlots) {
      timeSlotMap[ts._id.toString()] = ts;
    }

    const items = appointments.map((app) => {
      const timeSlot = timeSlotMap[app.timeSlotId?.toString()];
      let slotDetails = null;

      if (timeSlot && timeSlot.generatedSlots?.length > 0) {
        slotDetails = timeSlot.generatedSlots.find(
          (s) => s.slotId === app.slotId
        );
      }

      const technician = technicianMap[app.Employee?.toString()] || null;

      return {
        ...app,
        technicianDetails: technician
          ? {
              firstName: technician.firstName,
              lastName: technician.lastName,
              email: technician.email,
              phone: technician.phone,
              isActive: technician.isActive,
            }
          : null,
        slotDetails: slotDetails
          ? {
              startTime: slotDetails.startTime,
              endTime: slotDetails.endTime,
              isBreak: slotDetails.isBreak,
            }
          : null,
      };
    });

    const totalItems = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const pagination = {
      totalItems,
      totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber,
    };

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
    console.error("Error fetching appointments:", error);
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
        new ApiResponse(200, { date, slots }, "Slots retrieved successfully")
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

    // Normalize date - handle both string formats and Date objects
    let appointmentDate;
    if (typeof date === "string") {
      // Handle different date formats
      if (date.includes("GMT") || date.includes("UTC")) {
        // Already a full date string
        appointmentDate = new Date(date);
      } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO date format (YYYY-MM-DD)
        appointmentDate = new Date(date);
      } else {
        // Try to parse other formats
        appointmentDate = new Date(date);
      }
    } else if (date instanceof Date) {
      appointmentDate = date;
    } else {
      return res.status(400).json(new ApiError(400, "Invalid date format"));
    }

    // Validate that we have a valid date
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json(new ApiError(400, "Invalid date value"));
    }

    // Set to start of day to avoid timezone issues
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
      // Normalize date - handle both string formats and Date objects
      let parsedDate;
      if (typeof date === "string") {
        // Handle different date formats
        if (date.includes("GMT") || date.includes("UTC")) {
          // Already a full date string
          parsedDate = new Date(date);
        } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // ISO date format (YYYY-MM-DD)
          parsedDate = new Date(date);
        } else {
          // Try to parse other formats
          parsedDate = new Date(date);
        }
      } else if (date instanceof Date) {
        parsedDate = date;
      }

      // Validate that we have a valid date
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        parsedDate.setHours(0, 0, 0, 0);
        appointmentDate = parsedDate;
      } else {
        return res.status(400).json(new ApiError(400, "Invalid date format"));
      }
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
