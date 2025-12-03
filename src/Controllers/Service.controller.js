const Service = require("../Models/Service.model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Configure multer for service image uploads
const serviceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../public/Services");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "service-" + uniqueSuffix + ext);
  },
});

const uploadServiceImages = multer({ storage: serviceStorage });

// Create a new service
const createService = async (req, res) => {
  try {
    const { name, description, price, isActive, cart_Recommended } = req.body;

    if (!name || typeof price === "undefined") {
      return res
        .status(400)
        .json(new ApiError(400, "Name and price are required"));
    }

    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => `/Services/${f.filename}`)
      : [];

    const service = await Service.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      price: Number(price),
      images: uploadedImages,
      isActive: isActive === "true" || isActive === true,
      cart_Recommended: cart_Recommended === "true" || cart_Recommended === true,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, service, "Service created successfully"));
  } catch (error) {
    console.error("createService Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Get all services
const getAllServices = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { isDelete: false };

    if (typeof isActive !== "undefined") {
      filter.isActive = isActive === "true";
    }

    if (req.query.cart_Recommended) {
      filter.cart_Recommended = req.query.cart_Recommended === "true";
    }

    const services = await Service.find(filter).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, services, "Services fetched successfully"));
  } catch (error) {
    console.error("getAllServices Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Get service by ID
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);

    if (!service || service.isDelete) {
      return res.status(404).json(new ApiError(404, "Service not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, service, "Service fetched successfully"));
  } catch (error) {
    console.error("getServiceById Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Update service
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, isActive, images, cart_Recommended } = req.body;

    const service = await Service.findById(id);
    if (!service || service.isDelete) {
      return res.status(404).json(new ApiError(404, "Service not found"));
    }

    if (name) service.name = name.trim();
    if (typeof description !== "undefined") service.description = description.trim();
    if (typeof price !== "undefined") service.price = Number(price);
    if (typeof isActive !== "undefined") {
      service.isActive = isActive === "true" || isActive === true;
    }
    if (typeof cart_Recommended !== "undefined") {
      service.cart_Recommended = cart_Recommended === "true" || cart_Recommended === true;
    }

    // Handle images
    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => `/Services/${f.filename}`)
      : [];

    // Only update images if they are provided in the request or new files are uploaded
    if (typeof images !== "undefined" || uploadedImages.length > 0) {
      let keepImagesFromBody = [];
      if (images) {
        if (Array.isArray(images)) {
          keepImagesFromBody = images;
        } else if (typeof images === "string") {
          try {
            // Try parsing if it's a JSON string of array
            const parsed = JSON.parse(images);
            keepImagesFromBody = Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
            // If not JSON, treat as single string url
            keepImagesFromBody = [images];
          }
        }
      }

      // Combine kept images and new uploaded images
      const finalImages = [...keepImagesFromBody, ...uploadedImages];

      // Find images to delete (those in DB but not in finalImages)
      const imagesToDelete = service.images.filter(
        (img) => !finalImages.includes(img)
      );

      // Delete removed images from filesystem
      imagesToDelete.forEach((img) => {
        const filePath = path.join(__dirname, "../../public", img);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Failed to delete image: ${filePath}`, err);
          }
        }
      });

      service.images = finalImages;
    }

    await service.save();

    return res
      .status(200)
      .json(new ApiResponse(200, service, "Service updated successfully"));
  } catch (error) {
    console.error("updateService Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Delete service (Soft delete)
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service || service.isDelete) {
      return res.status(404).json(new ApiError(404, "Service not found"));
    }

    service.isDelete = true;
    await service.save();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Service deleted successfully"));
  } catch (error) {
    console.error("deleteService Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  uploadServiceImages,
};
