const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const Product = require("../Models/Product.model");
const Appointment = require("../Models/Appointment.model");
const Query = require("../Models/Contact.model");
const Order = require("../Models/Order.model");
const Holiday = require("../Models/Holiday.model");
const Technician = require("../Models/Technician.model");
const fs = require("fs");
const path = require("path");

const getAllProducts = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      isActive,
      minPrice,
      maxPrice,
      pattern,
      width,
      profile,
      loadRating,
      speedRating,
      size,
      color,
      fitments,
      staggeredOptions,
      diameter,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (name) filter.name = { $regex: name, $options: "i" };
    if (brand) filter.brand = { $regex: brand, $options: "i" };
    if (category) filter.category = category;
    if (typeof isActive !== "undefined") filter.isActive = isActive === "true";

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (pattern)
      filter["tyreSpecifications.pattern"] = { $regex: pattern, $options: "i" };
    if (width)
      filter["tyreSpecifications.width"] = { $regex: width, $options: "i" };
    if (profile)
      filter["tyreSpecifications.profile"] = { $regex: profile, $options: "i" };
    if (diameter)
      filter.$or = [
        { "tyreSpecifications.diameter": { $regex: diameter, $options: "i" } },
        { "wheelSpecifications.diameter": { $regex: diameter, $options: "i" } },
      ];
    if (loadRating)
      filter["tyreSpecifications.loadRating"] = {
        $regex: loadRating,
        $options: "i",
      };
    if (speedRating)
      filter["tyreSpecifications.speedRating"] = {
        $regex: speedRating,
        $options: "i",
      };
    if (size)
      filter["wheelSpecifications.size"] = { $regex: size, $options: "i" };
    if (color)
      filter["wheelSpecifications.color"] = { $regex: color, $options: "i" };
    if (fitments)
      filter["wheelSpecifications.fitments"] = {
        $regex: fitments,
        $options: "i",
      };
    if (staggeredOptions)
      filter["wheelSpecifications.staggeredOptions"] = {
        $regex: staggeredOptions,
        $options: "i",
      };

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { SKUname: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { "tyreSpecifications.pattern": searchRegex },
        { "tyreSpecifications.width": searchRegex },
        { "tyreSpecifications.profile": searchRegex },
        { "tyreSpecifications.loadRating": searchRegex },
        { "tyreSpecifications.speedRating": searchRegex },
        { "wheelSpecifications.size": searchRegex },
        { "wheelSpecifications.color": searchRegex },
        { "wheelSpecifications.fitments": searchRegex },
        { "wheelSpecifications.staggeredOptions": searchRegex },
      ];
    }

    let items;
    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      const skip = (pageNumber - 1) * limitNumber;

      items = await Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      const totalItems = await Product.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limitNumber);

      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    } else {
      items = await Product.find(filter).sort({ createdAt: -1 });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { items, pagination },
          "Products fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const CreateProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      images = [],
      sku,
      price,
      stock,
      tyreSpecifications = {},
      wheelSpecifications = {},
      isActive,
    } = req.body;

    if (
      !name ||
      !category ||
      !brand ||
      !sku ||
      typeof price === "undefined" ||
      typeof stock === "undefined"
    ) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "name, category, brand, sku, price and stock are required"
          )
        );
    }

    const existingProduct = await Product.findOne({
      name: name.trim(),
      sku: sku.trim(),
    });

    if (existingProduct) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            `Product with name "${name}" and SKU "${sku}" already exists`
          )
        );
    }

    // Handle uploaded images
    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => f.filename)
      : [];

    const finalImages = [
      ...(Array.isArray(images) ? images : images ? [images] : []),
      ...uploadedImages,
    ];

    // Convert price & stock to numbers if strings
    const priceNumber = typeof price === "string" ? Number(price) : price;
    const stockNumber = typeof stock === "string" ? Number(stock) : stock;

    if (isNaN(priceNumber) || isNaN(stockNumber)) {
      return res
        .status(400)
        .json(new ApiError(400, "price and stock must be valid numbers"));
    }

    let finalTyreSpecs = tyreSpecifications;
    let finalWheelSpecs = wheelSpecifications;

    if (typeof tyreSpecifications === "string") {
      try {
        finalTyreSpecs = JSON.parse(tyreSpecifications);
      } catch (_) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid tyreSpecifications JSON"));
      }
    }

    if (typeof wheelSpecifications === "string") {
      try {
        finalWheelSpecs = JSON.parse(wheelSpecifications);
      } catch (_) {
        return res
          .status(400)
          .json(new ApiError(400, "Invalid wheelSpecifications JSON"));
      }
    }

    const product = await Product.create({
      name,
      category,
      brand,
      description,
      images: finalImages,
      sku,
      price: priceNumber,
      stock: stockNumber,
      tyreSpecifications: finalTyreSpecs,
      wheelSpecifications: finalWheelSpecs,
      isActive,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, product, "Product created successfully"));
  } catch (error) {
    console.error("CreateProduct Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const getProductById = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Product id is required"));
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json(new ApiError(404, "Product not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, product, "Product fetched successfully"));
  } catch (error) {
    console.error("getProductById Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const DeleteProduct = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Product id is required"));
    }

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json(new ApiError(404, "Product not found"));
    }

    const images = Array.isArray(deleted.images) ? deleted.images : [];
    if (images.length > 0) {
      const deletions = images.map(async (filename) => {
        if (!filename) return;
        const filePath = path.join(__dirname, "../../public/Product", filename);
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          console.log(err);
        }
      });
      await Promise.all(deletions);
    }

    return res
      .status(200)
      .json(new ApiResponse(200, deleted, "Product deleted successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const UpdateProduct = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Product id is required"));
    }

    const existing = await Product.findById(id);
    if (!existing) {
      return res.status(404).json(new ApiError(404, "Product not found"));
    }

    const {
      name,
      category,
      brand,
      description,
      images, // list of images to keep
      price,
      stock,
      tyreSpecifications,
      wheelSpecifications,
      isActive,
      sku,
    } = req.body;

    if (typeof name !== "undefined") existing.name = name;
    if (typeof category !== "undefined") existing.category = category;
    if (typeof brand !== "undefined") existing.brand = brand;
    if (typeof description !== "undefined") existing.description = description;
    if (typeof sku !== "undefined") existing.sku = sku;
    if (typeof isActive !== "undefined")
      existing.isActive = isActive === true || isActive === "true";

    if (typeof price !== "undefined") {
      const priceNumber = typeof price === "string" ? Number(price) : price;
      if (isNaN(priceNumber)) {
        return res.status(400).json(new ApiError(400, "Invalid price value"));
      }
      existing.price = priceNumber;
    }

    if (typeof stock !== "undefined") {
      const stockNumber = typeof stock === "string" ? Number(stock) : stock;
      if (isNaN(stockNumber)) {
        return res.status(400).json(new ApiError(400, "Invalid stock value"));
      }
      existing.stock = stockNumber;
    }

    // Handle tyreSpecifications
    if (typeof tyreSpecifications !== "undefined") {
      let finalTyreSpecs = tyreSpecifications;
      if (typeof tyreSpecifications === "string") {
        try {
          finalTyreSpecs = JSON.parse(tyreSpecifications);
        } catch (_) {
          return res
            .status(400)
            .json(new ApiError(400, "Invalid tyreSpecifications JSON"));
        }
      }
      existing.tyreSpecifications = finalTyreSpecs;
    }

    // Handle wheelSpecifications
    if (typeof wheelSpecifications !== "undefined") {
      let finalWheelSpecs = wheelSpecifications;
      if (typeof wheelSpecifications === "string") {
        try {
          finalWheelSpecs = JSON.parse(wheelSpecifications);
        } catch (_) {
          return res
            .status(400)
            .json(new ApiError(400, "Invalid wheelSpecifications JSON"));
        }
      }
      existing.wheelSpecifications = finalWheelSpecs;
    }

    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => f.filename)
      : [];

    let keepImagesFromBody;
    if (Object.prototype.hasOwnProperty.call(req.body, "images")) {
      if (Array.isArray(images)) {
        keepImagesFromBody = images;
      } else if (typeof images === "string") {
        try {
          const parsed = JSON.parse(images);
          keepImagesFromBody = Array.isArray(parsed)
            ? parsed
            : parsed
            ? [parsed]
            : [];
        } catch (_) {
          keepImagesFromBody = images ? [images] : [];
        }
      } else if (images == null) {
        keepImagesFromBody = [];
      } else {
        keepImagesFromBody = [];
      }
    }

    if (
      typeof keepImagesFromBody !== "undefined" ||
      uploadedImages.length > 0
    ) {
      const keepList =
        typeof keepImagesFromBody !== "undefined"
          ? keepImagesFromBody || []
          : Array.isArray(existing.images)
          ? existing.images
          : [];
      const finalImages = Array.from(new Set([...keepList, ...uploadedImages]));

      const previousImages = Array.isArray(existing.images)
        ? existing.images
        : [];
      const toDelete = previousImages.filter(
        (img) => !finalImages.includes(img)
      );

      if (toDelete.length > 0) {
        const deletions = toDelete.map(async (filename) => {
          if (!filename) return;
          const filePath = path.join(
            __dirname,
            "../../public/Product",
            filename
          );
          try {
            await fs.promises.unlink(filePath);
          } catch (_) {}
        });
        await Promise.all(deletions);
      }

      existing.images = finalImages;
    }

    const saved = await existing.save();
    return res
      .status(200)
      .json(new ApiResponse(200, saved, "Product updated successfully"));
  } catch (error) {
    console.error("UpdateProduct Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const BestSellerProduct = async () => {
  try {
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const DashboardCount = async (req, res) => {
  try {
    const [
      productCount,
      appointmentCount,
      queryCount,
      orderCount,
      holidayCount,
      employeeCount,
    ] = await Promise.all([
      Product.countDocuments(),
      Appointment.countDocuments(),
      Query.countDocuments(),
      Order.countDocuments(),
      Holiday.countDocuments(),
      Technician.countDocuments(),
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          productCount,
          appointmentCount,
          queryCount,
          orderCount,
          holidayCount,
          employeeCount,
        },
        "Counts fetched successfully"
      )
    );
  } catch (error) {
    console.error("DashboardCount Error:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const HomeData = async (req, res) => {
  try {
    const bestSellersAgg = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.id",
          totalOrdered: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalOrdered: -1 } },
      { $limit: 2 },
    ]);

    const bestSellerIds = bestSellersAgg.map(
      (p) => new mongoose.Types.ObjectId(p._id)
    );

    const bestSellerProducts = await Product.find({
      _id: { $in: bestSellerIds },
    });

    const sortedBestSellers = bestSellerIds.map((id) =>
      bestSellerProducts.find((p) => p._id.equals(id))
    );

    const randomProducts = await Product.aggregate([{ $sample: { size: 10 } }]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          productData: randomProducts,
          bestSeller: sortedBestSellers,
        },
        "HomeData fetched successfully"
      )
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllProducts,
  CreateProduct,
  DeleteProduct,
  getProductById,
  BestSellerProduct,
  DashboardCount,
  UpdateProduct,
  HomeData,
};
