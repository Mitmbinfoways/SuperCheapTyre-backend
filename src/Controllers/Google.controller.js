const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const GoogleReview = async (req, res) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${process.env.GOOGLE_PLACE_ID}&fields=name,rating,reviews,user_ratings_total&key=${process.env.GOOGLE_REVIEW_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.result.reviews || []);
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

module.exports = {
  GoogleReview,
};
