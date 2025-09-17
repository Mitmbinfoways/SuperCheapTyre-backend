const express = require("express");
const ContactRoute = express.Router();
const {
  getAllContacts,
  createContact,
} = require("../Controllers/Contact.controller");

ContactRoute.get("/", getAllContacts);
ContactRoute.post("/", createContact);

module.exports = ContactRoute;
