const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const TimeSlot = require("../Models/TimeSlot.model");

// Helper function to convert time string to minutes
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper function to convert minutes to time string
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};

// Helper function to generate time slots
const generateTimeSlots = (startTime, endTime, breakTime, duration) => {
  const slots = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const breakStart = breakTime?.start ? timeToMinutes(breakTime.start) : null;
  const breakEnd = breakTime?.end ? timeToMinutes(breakTime.end) : null;

  let currentTime = startMinutes;
  let slotNumber = 1;

  while (currentTime + duration <= endMinutes) {
    // If current slot overlaps with break time
    if (
      breakStart !== null &&
      breakEnd !== null &&
      currentTime < breakEnd &&
      currentTime + duration > breakStart
    ) {
      // Push the break slot
      slots.push({
        slotId: `break_${slotNumber}`,
        startTime: minutesToTime(breakStart),
        endTime: minutesToTime(breakEnd),
        isBreak: true,
      });

      // Skip to after the break
      currentTime = breakEnd;
    } else {
      // Normal slot
      const slotStartTime = minutesToTime(currentTime);
      const slotEndTime = minutesToTime(currentTime + duration);

      slots.push({
        slotId: `slot_${slotNumber}`,
        startTime: slotStartTime,
        endTime: slotEndTime,
        isBreak: false,
      });

      currentTime += duration;
      slotNumber++;
    }
  }
  return slots;
};

// GET /timeslots
const getAllTimeSlots = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const timeSlots = await TimeSlot.find(filter).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, timeSlots, "Time slots fetched successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// GET /timeslots/:id
const getTimeSlotById = async (req, res) => {
  try {
    const { id } = req.params;
    const timeSlot = await TimeSlot.findById(id);

    if (!timeSlot) {
      return res.status(404).json(new ApiError(404, "Time slot not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, timeSlot, "Time slot fetched successfully"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// POST /timeslots
const createTimeSlot = async (req, res) => {
  try {
    console.log(req.body)
    const { startTime, endTime, breakTime, duration } = req.body;

    if (!startTime || !endTime || !duration) {
      return res
        .status(400)
        .json(
          new ApiError(400, "startTime, endTime, and duration are required")
        );
    }

    const existingTimeSlot = await TimeSlot.findOne();
    if (existingTimeSlot) {
      return res
        .status(400)
        .json(new ApiError(400, "Only one time slot can be created"));
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      return res
        .status(400)
        .json(new ApiError(400, "Start time must be before end time"));
    }

    // Validate break time if provided
    if (breakTime?.start && breakTime?.end) {
      const breakStart = timeToMinutes(breakTime.start);
      const breakEnd = timeToMinutes(breakTime.end);

      if (breakStart >= breakEnd) {
        return res
          .status(400)
          .json(new ApiError(400, "Break start must be before break end"));
      }

      if (breakStart < startMinutes || breakEnd > endMinutes) {
        return res
          .status(400)
          .json(new ApiError(400, "Break must be within working hours"));
      }
    }

    const generatedSlots = generateTimeSlots(
      startTime,
      endTime,
      breakTime,
      duration
    );

    if (generatedSlots.length === 0) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "No valid time slots can be generated with the given parameters"
          )
        );
    }

    const timeSlot = await TimeSlot.create({
      startTime,
      endTime,
      breakTime: breakTime || null,
      duration,
      generatedSlots,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, timeSlot, "Time slot created successfully"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// PATCH /timeslots/:id
const updateTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, breakTime, duration, isActive } = req.body;

    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return res.status(404).json(new ApiError(404, "Time slot not found"));
    }

    const newStartTime = startTime || timeSlot.startTime;
    const newEndTime = endTime || timeSlot.endTime;
    const newBreakTime =
      breakTime !== undefined ? breakTime : timeSlot.breakTime;
    const newDuration = duration || timeSlot.duration;

    const startMinutes = timeToMinutes(newStartTime);
    const endMinutes = timeToMinutes(newEndTime);

    if (startMinutes >= endMinutes) {
      return res
        .status(400)
        .json(new ApiError(400, "Start time must be before end time"));
    }

    // Validate break if provided
    if (newBreakTime?.start && newBreakTime?.end) {
      const breakStart = timeToMinutes(newBreakTime.start);
      const breakEnd = timeToMinutes(newBreakTime.end);

      if (breakStart >= breakEnd) {
        return res
          .status(400)
          .json(new ApiError(400, "Break start must be before break end"));
      }

      if (breakStart < startMinutes || breakEnd > endMinutes) {
        return res
          .status(400)
          .json(new ApiError(400, "Break must be within working hours"));
      }
    }

    const generatedSlots = generateTimeSlots(
      newStartTime,
      newEndTime,
      newBreakTime,
      newDuration
    );

    if (generatedSlots.length === 0) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "No valid time slots can be generated with the given parameters"
          )
        );
    }

    timeSlot.startTime = newStartTime;
    timeSlot.endTime = newEndTime;
    timeSlot.breakTime = newBreakTime;
    timeSlot.duration = newDuration;
    timeSlot.generatedSlots = generatedSlots;

    if (isActive !== undefined) {
      timeSlot.isActive = isActive;
    }

    await timeSlot.save();

    return res
      .status(200)
      .json(new ApiResponse(200, timeSlot, "Time slot updated successfully"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// DELETE /timeslots/:id
const deleteTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const timeSlot = await TimeSlot.findById(id);

    if (!timeSlot) {
      return res.status(404).json(new ApiError(404, "Time slot not found"));
    }

    await TimeSlot.findByIdAndDelete(id);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Time slot deleted successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllTimeSlots,
  createTimeSlot,
  getTimeSlotById,
  updateTimeSlot,
  deleteTimeSlot,
};
