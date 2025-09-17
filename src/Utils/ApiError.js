class ApiError extends Error {
    constructor(statusCode, errorData, message = "Failed") {
      super(message);
      this.statusCode = statusCode;
      this.errorData = errorData;
      this.message = message;
    }
  }
  
  module.exports = ApiError;
  