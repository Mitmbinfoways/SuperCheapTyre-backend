const Blog = require("../Models/Blog.model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");

const getAllBlogs = async (req, res) => {
  try {
    let { page = 1, limit = 10, search } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
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
      const images = req.files?.map((file) => `Blog/${file.filename}`) || [];

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
    } else if (["card", "alternative"].includes(formate)) {
      let parsedItems = [];
      if (typeof items === "string") parsedItems = JSON.parse(items);
      else if (Array.isArray(items)) parsedItems = items;

      if (!parsedItems.length)
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              null,
              "Items array (with image and content) is required for card/alternative format"
            )
          );

      blogData.items = parsedItems;
    }

    const blog = await Blog.create(blogData);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const responseData = {
      ...blog.toObject(),
      imageUrls:
        blog.images && blog.images.length
          ? blog.images.map((img) => `${baseUrl}/${img}`)
          : [],
    };
    return res
      .status(201)
      .json(new ApiResponse(201, responseData, "Blog created successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to create blog"));
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, formate, items, isActive } = req.body;

    if (!id)
      return res.status(400).json(new ApiError(400, "Blog ID is required"));

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json(new ApiError(404, "Blog not found"));

    if (title !== undefined) blog.title = title;
    if (tags !== undefined) blog.tags = tags;
    if (formate !== undefined) blog.formate = formate;
    if (isActive !== undefined) blog.isActive = isActive; // <-- update

    if (formate === "carousel") {
      const images = req.files ? req.files.map((file) => `Blog/${file.filename}`) : [];
      if (images.length > 0) blog.images = images;
      if (content !== undefined) blog.content = content;
      blog.items = [];
    } else if (["card", "alternative"].includes(formate)) {
      let parsedItems = [];
      if (typeof items === "string") parsedItems = JSON.parse(items);
      else if (Array.isArray(items)) parsedItems = items;

      if (parsedItems.length > 0) blog.items = parsedItems;
      blog.images = [];
      blog.content = "";
    }

    await blog.save();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const responseData = {
      ...blog.toObject(),
      imageUrls:
        blog.images && blog.images.length
          ? blog.images.map((img) => `${baseUrl}/${img}`)
          : [],
    };
    return res
      .status(200)
      .json(new ApiResponse(200, responseData, "Blog updated successfully"));
  } catch (error) {
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

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) return res.status(404).json(new ApiError(404, "Blog not found"));

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Blog deleted successfully"));
  } catch (error) {
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
