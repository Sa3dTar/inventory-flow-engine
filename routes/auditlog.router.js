const express = require('express');
const router = express.Router();
const {
  getAllAuditLogs,
  getAuditLogById,
  logActionManual
} = require('../controller/auditlog.controller');

// جلب جميع السجلات (مع إمكانية الفلترة عبر الـ Query Params)
router.get('/', getAllAuditLogs);

// جلب سجل محدد بالـ ID
router.get('/:id', getAuditLogById);

// تسجيل حدث يدوياً (اختياري)
router.post('/', logActionManual);

module.exports = router;