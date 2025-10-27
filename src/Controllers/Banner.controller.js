const Banner = require("../Models/Banner.model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");
const path = require("path");
const fs = require("fs");

// Configure multer for banner image uploads
const multer = require("multer");

const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../public/Banners");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "banner-" + uniqueSuffix + ext);
  },
});

const uploadBannerImages = multer({ storage: bannerStorage });

// Get all active banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true, isDelete: false })
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          banners,
          "Banners fetched successfully"
        )
      );
  } catch (error) {
    console.error("getAllBanners Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Create multiple banners
const createBanners = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    // Check if files are uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "At least one image is required"
          )
        );
    }

    // Get the files from multer
    const laptopImageFiles = req.files['laptopImage'] || [];
    const mobileImageFiles = req.files['mobileImage'] || [];
    
    // Check if we have matching pairs
    if (laptopImageFiles.length !== mobileImageFiles.length) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Number of laptop images must match number of mobile images"
          )
        );
    }

    if (laptopImageFiles.length === 0) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "At least one pair of images is required"
          )
        );
    }

    // Create banner documents for each pair
    const banners = [];
    for (let i = 0; i < laptopImageFiles.length; i++) {
      const laptopImageFile = laptopImageFiles[i];
      const mobileImageFile = mobileImageFiles[i];
      
      const banner = await Banner.create({
        laptopImage: `/Banners/${laptopImageFile.filename}`,
        mobileImage: `/Banners/${mobileImageFile.filename}`,
        isActive: isActive === 'true' || isActive === true || true, // Default to active if not specified
      });
      
      banners.push(banner);
    }

    return res
      .status(201)
      .json(new ApiResponse(201, banners, "Banners created successfully"));
  } catch (error) {
    console.error("createBanners Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Create a single banner (kept for backward compatibility)
const createBanner = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    // Check if files are uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Both laptop and mobile images are required"
          )
        );
    }

    // Get the file paths from multer
    const laptopImageFile = req.files['laptopImage'] ? req.files['laptopImage'][0] : null;
    const mobileImageFile = req.files['mobileImage'] ? req.files['mobileImage'][0] : null;

    if (!laptopImageFile || !mobileImageFile) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Both laptop and mobile images are required with correct field names"
          )
        );
    }

    const banner = await Banner.create({
      laptopImage: `/Banners/${laptopImageFile.filename}`,
      mobileImage: `/Banners/${mobileImageFile.filename}`,
      isActive: isActive === 'true' || isActive === true || true, // Default to active if not specified
    });

    return res
      .status(201)
      .json(new ApiResponse(201, banner, "Banner created successfully"));
  } catch (error) {
    console.error("createBanner Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Update a banner
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(new ApiError(404, "Banner not found"));
    }

    // Update images if provided
    if (req.files) {
      if (req.files['laptopImage']) {
        const laptopImageFile = req.files['laptopImage'][0];
        // Delete old image if exists
        if (banner.laptopImage) {
          const oldImagePath = path.join(__dirname, "../../public", banner.laptopImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        banner.laptopImage = `/Banners/${laptopImageFile.filename}`;
      }
      
      if (req.files['mobileImage']) {
        const mobileImageFile = req.files['mobileImage'][0];
        // Delete old image if exists
        if (banner.mobileImage) {
          const oldImagePath = path.join(__dirname, "../../public", banner.mobileImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        banner.mobileImage = `/Banners/${mobileImageFile.filename}`;
      }
    }

    if (typeof isActive !== "undefined") {
      banner.isActive = isActive === 'true' || isActive === true;
    }

    await banner.save();

    return res
      .status(200)
      .json(new ApiResponse(200, banner, "Banner updated successfully"));
  } catch (error) {
    console.error("updateBanner Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

// Delete a banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(new ApiError(404, "Banner not found"));
    }

    // Delete images from filesystem
    if (banner.laptopImage) {
      const laptopImagePath = path.join(__dirname, "../../public", banner.laptopImage);
      if (fs.existsSync(laptopImagePath)) {
        fs.unlinkSync(laptopImagePath);
      }
    }

    if (banner.mobileImage) {
      const mobileImagePath = path.join(__dirname, "../../public", banner.mobileImage);
      if (fs.existsSync(mobileImagePath)) {
        fs.unlinkSync(mobileImagePath);
      }
    }

    // Soft delete
    banner.isDelete = true;
    await banner.save();

    return res
      .status(200)
      .json(new ApiResponse(200, banner, "Banner deleted successfully"));
  } catch (error) {
    console.error("deleteBanner Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  getAllBanners,
  createBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImages
};
