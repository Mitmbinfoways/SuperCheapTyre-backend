const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../Controllers/Webhook.controller');

router.post('/', handleWebhook);

module.exports = router;
