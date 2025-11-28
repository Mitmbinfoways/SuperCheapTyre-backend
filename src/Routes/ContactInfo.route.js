const express = require("express");
const router = express.Router();
const ContactInfoController = require("../Controllers/ContactInfo.controller");

router.post("/", ContactInfoController.createContactInfo);
router.get("/", ContactInfoController.getContactInfo);
router.put("/:id", ContactInfoController.updateContactInfo);
router.delete("/:id", ContactInfoController.deleteContactInfo);

module.exports = router;
