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
      .json(new ApiError(500, null, error.message || "Failed to fetch blogs"));
  }
};

const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Blog ID is required"));
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json(new ApiError(404, null, "Blog not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, blog, "Blog fetched successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, null, error.message || "Failed to fetch blog"));
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, content, tags, formate } = req.body;
    if (!title || !content || !formate) {
      return res
        .status(400)
        .json(
          new ApiError(400, null, "Title and content and formate are required")
        );
    }

    const images = req.files ? req.files.map((file) => file.filename) : [];
    const blog = await Blog.create({ title, content, tags, images, formate });

    return res
      .status(201)
      .json(new ApiResponse(201, blog, "Blog created successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, null, error.message || "Failed to create blog"));
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id, title, content, tags } = req.body;
    if (!id) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Blog ID is required"));
    }

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json(new ApiError(404, null, "Blog not found"));
    }

    if (req.files && req.files.length > 0) {
      blog.images = req.files.map((file) => file.filename);
    }

    if (title !== undefined) blog.title = title;
    if (content !== undefined) blog.content = content;
    if (tags !== undefined) blog.tags = tags;

    await blog.save();
    return res
      .status(200)
      .json(new ApiResponse(200, blog, "Blog updated successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, null, error.message || "Failed to update blog"));
  }
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Blog ID is required"));
    }

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res.status(404).json(new ApiError(404, null, "Blog not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Blog deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, null, error.message || "Failed to delete blog"));
  }
};

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
};
