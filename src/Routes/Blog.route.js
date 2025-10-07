const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} = require("../Controllers/Blog.controller");

const BlogRoute = express.Router();

// Multer setup for blog images
const blogStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../public/Blog");
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (err) {
      return cb(err);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "blog-" + uniqueSuffix + ext);
  },
});

const uploadBlogImages = multer({ storage: blogStorage });

// Routes
BlogRoute.get("/", getAllBlogs);
BlogRoute.get("/:id", getBlogById);
BlogRoute.post("/", uploadBlogImages.array("images", 5), createBlog);
BlogRoute.patch("/:id", uploadBlogImages.array("images", 5), updateBlog);
BlogRoute.delete("/:id", deleteBlog);

module.exports = BlogRoute;
