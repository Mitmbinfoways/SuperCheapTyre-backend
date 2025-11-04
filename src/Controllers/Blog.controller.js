const fs = require("fs");
const path = require("path");
const Blog = require("../Models/Blog.model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");

const getAllBlogs = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, isActive, formate } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof isActive !== "undefined") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    if (
      formate &&
      ["carousel", "card", "alternative", "center"].includes(formate)
    ) {
      filter.formate = formate;
    }

    const totalBlogs = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          blogs,
          pagination: {
            total: totalBlogs,
            page,
            limit,
            totalPages: Math.ceil(totalBlogs / limit),
          },
        },
        "Blogs fetched successfully"
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to fetch blogs"));
  }
};

const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json(new ApiError(400, "Blog ID is required"));
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json(new ApiError(404, "Blog not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, blog, "Blog fetched successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to fetch blog"));
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, content, tags, formate, items, isActive = true } = req.body;

    if (!title || !formate) {
      return res
        .status(400)
        .json(new ApiError(400, "Title and formate are required fields"));
    }

    let blogData = { title, tags, formate, isActive };

    if (formate === "carousel") {
      const images =
        req.files?.images?.map((file) => `Blog/${file.filename}`) || [];

      if (!content)
        return res
          .status(400)
          .json(new ApiError(400, "Content is required for carousel format"));

      if (images.length === 0)
        return res
          .status(400)
          .json(
            new ApiError(400, "At least one image is required for carousel")
          );

      blogData.images = images;
      blogData.content = content;
    } else if (["card", "alternative", "center"].includes(formate)) {
      let parsedItems = [];
      if (typeof items === "string") parsedItems = JSON.parse(items);
      else if (Array.isArray(items)) parsedItems = items;

      if (!parsedItems.length)
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Items array (with image and content) is required for card/alternative/center format"
            )
          );

      // Process item images
      const itemImageFiles = req.files?.itemImages || [];

      const updatedItems = parsedItems.map((item, index) => {
        if (itemImageFiles[index]) {
          return {
            ...item,
            image: `Blog/${itemImageFiles[index].filename}`,
          };
        }
        return {
          ...item,
          image:
            item.image === "new_upload"
              ? "placeholder.jpg"
              : item.image || "placeholder.jpg",
        };
      });

      blogData.items = updatedItems;
    }

    const blog = await Blog.create(blogData);

    return res
      .status(201)
      .json(new ApiResponse(201, blog, "Blog created successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to create blog"));
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, formate, items, isActive, existingImages } =
      req.body;

    if (!id)
      return res.status(400).json(new ApiError(400, "Blog ID is required"));

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json(new ApiError(404, "Blog not found"));

    if (title !== undefined) blog.title = title;
    if (tags !== undefined) blog.tags = tags;
    if (formate !== undefined) blog.formate = formate;
    if (isActive !== undefined) blog.isActive = isActive;

    if (formate === "carousel") {
      // Get newly uploaded images
      const newImages =
        req.files?.images?.map((file) => `Blog/${file.filename}`) || [];

      // Parse existing images from request body (sent from frontend)
      let parsedExistingImages = [];
      if (existingImages) {
        parsedExistingImages =
          typeof existingImages === "string"
            ? JSON.parse(existingImages)
            : existingImages;
      }

      // Find images to delete (images in blog.images but not in parsedExistingImages)
      const imagesToDelete = blog.images.filter(
        (img) => !parsedExistingImages.includes(img)
      );

      // Delete removed images from file system
      imagesToDelete.forEach((imagePath) => {
        const fullPath = path.join(__dirname, "../../public", imagePath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`Deleted image: ${imagePath}`);
          } catch (error) {
            console.error(`Failed to delete image: ${imagePath}`, error);
          }
        }
      });

      // Combine existing images with new uploads
      if (newImages.length > 0 || parsedExistingImages.length > 0) {
        blog.images = [...parsedExistingImages, ...newImages];
      }

      if (content !== undefined) blog.content = content;
      blog.items = [];
    } else if (["card", "alternative", "center"].includes(formate)) {
      // Only process items if they were provided
      if (items !== undefined) {
        let parsedItems = [];
        if (typeof items === "string") parsedItems = JSON.parse(items);
        else if (Array.isArray(items)) parsedItems = items;

        // Process item images - all uploaded files are in itemImages array
        const itemImageFiles = req.files?.itemImages || [];

        // Collect old item images before updating
        const oldItemImages = blog.items.map((item) => item.image);

        // Track which new images have been assigned
        let newImageIndex = 0;

        // Map item images to their respective items
        const updatedItems = parsedItems.map((item, index) => {
          // If this item has "new_upload", assign the next available uploaded file
          if (
            item.image === "new_upload" &&
            newImageIndex < itemImageFiles.length
          ) {
            const assignedImage = `Blog/${itemImageFiles[newImageIndex].filename}`;
            newImageIndex++;
            return {
              ...item,
              image: assignedImage,
            };
          }

          // Keep existing image if it's already set and not "new_upload"
          if (item.image && item.image !== "new_upload") {
            return {
              ...item,
              image: item.image,
            };
          }

          // Fallback to existing blog item image or placeholder
          return {
            ...item,
            image: blog.items[index]?.image || "placeholder.jpg",
          };
        });

        // Find item images to delete (images in oldItemImages but not in updatedItems)
        const newItemImages = updatedItems.map((item) => item.image);
        const itemImagesToDelete = oldItemImages.filter(
          (img) =>
            img && img !== "placeholder.jpg" && !newItemImages.includes(img)
        );

        // Delete removed item images from file system
        itemImagesToDelete.forEach((imagePath) => {
          const fullPath = path.join(__dirname, "../../public", imagePath);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`Deleted item image: ${imagePath}`);
            } catch (error) {
              console.error(`Failed to delete item image: ${imagePath}`, error);
            }
          }
        });
        if (updatedItems.length > 0) blog.items = updatedItems;
      }

      // Delete old carousel images if format changed from carousel
      if (blog.images && blog.images.length > 0) {
        blog.images.forEach((imagePath) => {
          const fullPath = path.join(__dirname, "../../public", imagePath);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`Deleted carousel image: ${imagePath}`);
            } catch (error) {
              console.error(
                `Failed to delete carousel image: ${imagePath}`,
                error
              );
            }
          }
        });
      }

      blog.images = [];
      blog.content = "";
    }

    await blog.save();

    return res
      .status(200)
      .json(new ApiResponse(200, blog, "Blog updated successfully"));
  } catch (error) {
    console.error("Update blog error:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to update blog"));
  }
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json(new ApiError(400, "Blog ID is required"));

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json(new ApiError(404, "Blog not found"));

    const allImagesToDelete = [];

    if (blog.images && blog.images.length > 0) {
      allImagesToDelete.push(...blog.images);
    }

    if (blog.items && blog.items.length > 0) {
      blog.items.forEach((item) => {
        if (item.image && item.image !== "placeholder.jpg") {
          allImagesToDelete.push(item.image);
        }
      });
    }

    allImagesToDelete.forEach((imagePath) => {
      const fullPath = path.join(__dirname, "../../public", imagePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`Deleted blog image: ${imagePath}`);
        } catch (error) {
          console.error(`Failed to delete blog image: ${imagePath}`, error);
        }
      }
    });

    await Blog.findByIdAndDelete(id);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "Blog deleted successfully and images removed"
        )
      );
  } catch (error) {
    console.error("Delete blog error:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to delete blog"));
  }
};

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
};
