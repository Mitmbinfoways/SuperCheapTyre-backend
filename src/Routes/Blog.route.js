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

// Configure multer to accept both "images" and "itemImages" fields
const uploadBlogImages = multer({ storage: blogStorage });

// Middleware to handle multiple file fields
const uploadBlogFiles = (req, res, next) => {
  const multerMiddleware = uploadBlogImages.fields([
    { name: 'images', maxCount: 10 },
    { name: 'itemImages', maxCount: 20 }
  ]);
  
  multerMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Too many files uploaded' });
      }
    } else if (err) {
      return res.status(500).json({ error: 'File upload error' });
    }
    next();
  });
};

// Routes
BlogRoute.get("/", getAllBlogs);
BlogRoute.get("/:id", getBlogById);
BlogRoute.post("/", uploadBlogFiles, createBlog);
BlogRoute.patch("/:id", uploadBlogFiles, updateBlog);
BlogRoute.delete("/:id", deleteBlog);

module.exports = BlogRoute;