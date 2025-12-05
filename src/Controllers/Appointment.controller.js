const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");
const Technician = require("../Models/Technician.model");
const sendMail = require("../Utils/Nodemailer");
const Order = require("../Models/Order.model");

const generateAdminAppointmentEmail = (appointment, slotInfo) => {
  return `
    <h2>New Appointment Created</h2>

    <p><strong>Name:</strong> ${appointment.firstname} ${appointment.lastname
    }</p>
    <p><strong>Phone:</strong> ${appointment.phone}</p>
    <p><strong>Email:</strong> ${appointment.email}</p>

    <p><strong>Date:</strong> ${appointment.date}</p>
    <p><strong>Time Slot:</strong> ${slotInfo ? `${slotInfo.startTime} - ${slotInfo.endTime}` : "N/A"
    }</p>

  `;
};

const getAllAppointments = async (req, res) => {
  try {
    const { status, search, page, limit } = req.query;

    const filter = { isDelete: false };
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

    const usePagination = page && limit;

    let appointmentsQuery = Appointment.find(filter).sort({ createdAt: -1 });

    let pageNumber, limitNumber, skip;
    if (usePagination) {
      pageNumber = parseInt(page, 10) || 1;
      limitNumber = parseInt(limit, 10) || 10;
      skip = (pageNumber - 1) * limitNumber;

      appointmentsQuery = appointmentsQuery.skip(skip).limit(limitNumber);
    }

    const appointments = await appointmentsQuery.lean();

    const technicianIds = [
      ...new Set(appointments.map((a) => a.Employee).filter(Boolean)),
    ];

    const technicians = await Technician.find({
      _id: { $in: technicianIds },
    })
      .select("firstName lastName email phone isActive isDelete")
      .lean();

    const technicianMap = {};
    technicians.forEach((tech) => {
      technicianMap[tech._id.toString()] = tech;
    });

    const timeSlotIds = [...new Set(appointments.map((a) => a.timeSlotId))];
    const timeSlots = await TimeSlot.find({
      _id: { $in: timeSlotIds },
    }).lean();

    const timeSlotMap = {};
    timeSlots.forEach((ts) => {
      timeSlotMap[ts._id.toString()] = ts;
    });

    const items = appointments.map((app) => {
      const timeSlot = timeSlotMap[app.timeSlotId?.toString()];
      let slotDetails = null;

      if (timeSlot?.generatedSlots?.length > 0) {
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

    if (!usePagination) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { items },
            "Appointments fetched successfully"
          )
        );
    }

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

const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOne({
      _id: id,
      isDelete: false,
    }).lean();

    if (!appointment) {
      return res.status(404).json(new ApiError(404, "Appointment not found"));
    }

    // Populate details
    const technician = appointment.Employee
      ? await Technician.findById(appointment.Employee).select(
        "firstName lastName email phone isActive"
      )
      : null;

    const timeSlot = appointment.timeSlotId
      ? await TimeSlot.findById(appointment.timeSlotId).lean()
      : null;

    let slotDetails = null;
    if (timeSlot && timeSlot.generatedSlots?.length > 0) {
      slotDetails = timeSlot.generatedSlots.find(
        (s) => s.slotId === appointment.slotId
      );
    }

    const data = {
      ...appointment,
      technicianDetails: technician || null,
      slotDetails: slotDetails
        ? {
          startTime: slotDetails.startTime,
          endTime: slotDetails.endTime,
          isBreak: slotDetails.isBreak,
        }
        : null,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, data, "Appointment fetched successfully"));
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const getAvailableSlots = async (req, res) => {
  try {
    const { date, timeSlotId } = req.query;

    if (!date) {
      return res.status(400).json(new ApiError(400, "Date is required"));
    }

    // Use date string directly
    const queryDate = date;

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
      status: { $in: ["reserved", "confirmed", "booked"] },
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
      Employee,
    } = req.body;

    if (!date || !slotId) {
      return res
        .status(400)
        .json(new ApiError(400, "Date and slotId are required"));
    }

    // Normalize date - handle both string formats and Date objects
    // let appointmentDate;
    // if (typeof date === "string") {
    //   // Handle different date formats
    //   if (date.includes("GMT") || date.includes("UTC")) {
    //     // Already a full date string
    //     appointmentDate = new Date(date);
    //   } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    //     // ISO date format (YYYY-MM-DD)
    //     appointmentDate = new Date(date);
    //   } else {
    //     // Try to parse other formats
    //     appointmentDate = new Date(date);
    //   }
    // } else if (date instanceof Date) {
    //   appointmentDate = date;
    // } else {
    //   return res.status(400).json(new ApiError(400, "Invalid date format"));
    // }

    // Validate that we have a valid date
    // if (isNaN(appointmentDate.getTime())) {
    //   return res.status(400).json(new ApiError(400, "Invalid date value"));
    // }

    // Set to start of day to avoid timezone issues
    // appointmentDate.setHours(0, 0, 0, 0);

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
      date: date,
      slotId: validSlot.slotId,
      status: { $in: ["reserved", "confirmed", "booked"] },
      isDelete: false,
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
      date: date,
      slotId: validSlot.slotId,
      timeSlotId: timeSlotConfig._id,
      notes,
      Employee: Employee || "",
      status: status || "booked",
    });

    try {
      const slotInfo = {
        startTime: validSlot.startTime,
        endTime: validSlot.endTime,
        isBreak: validSlot.isBreak,
      };

      const adminHTML = generateAdminAppointmentEmail(created, slotInfo);

      await sendMail(
        process.env.SMTP_USER,
        "New Appointment Created",
        adminHTML
      );
    } catch (emailError) {
      console.error("Email Error:", emailError);
    }

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
    const appointment = await Appointment.findOne({ _id: id, isDelete: false });
    if (!appointment) {
      return res.status(404).json(new ApiError(404, "Appointment not found"));
    }

    // If updating date or slot, validate
    let appointmentDate = appointment.date;
    if (date) {
      let parsedDate;

      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split("-");
        parsedDate = new Date(Number(y), Number(m) - 1, Number(d));
      } else {
        parsedDate = new Date(date);
      }

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
        (slot) => slot.slotId === slotId
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
        slotId: validSlot.slotId,
        status: { $in: ["reserved", "confirmed", "booked"] },
        isDelete: false,
      });

      if (already) {
        return res
          .status(400)
          .json(new ApiError(400, "This slot is already booked"));
      }

      updatedSlotId = validSlot.slotId;
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
// ... existing code ...

const DeleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json(new ApiError(404, "Appointment not found"));
    }

    const orders = await Order.find({ "appointment.id": id });

    const hasPayment = orders.some(order =>
      order.payment && order.payment.some(p => p.amount > 0)
    );

    if (hasPayment) {
      return res.status(400).json(new ApiError(400, "This appointment cannot be deleted because it has associated payment records"));
    }

    appointment.isDelete = true;
    appointment.status = "cancelled";
    await appointment.save();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Appointment deleted successfully"));
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
  DeleteAppointment,
};
