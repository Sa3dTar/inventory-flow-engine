const AuditLog = require('../database/auditlog'); // تأكد من مسار الـ Model حسب هيكل مشروعك

// 1. تسجيل حدث تدقيق جديد (يمكن استدعاؤها داخلياً من أي Controller آخر أو كـ Middleware)
exports.createAuditLog = async ({ userId, action, entity, entityId, details, ipAddress }) => {
  try {
    const log = new AuditLog({
      userId,
      action,
      entity,
      entityId,
      details,
      ipAddress
    });
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
};

// 2. جلب كافة سجلات التدقيق (مع خيارات التصفية والبحث)
exports.getAllAuditLogs = async (req, res) => {
  try {
    const { userId, action, entity, startDate, endDate } = req.query;
    let query = {};

    // تصفية النتائج حسب المعايير المتاحة
    if (userId) query.userId = userId;
    if (action) query.action = action.toUpperCase();
    if (entity) query.entity = entity;

    // تصفية حسب النطاق الزمني
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 }); // الأحدث أولاً

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. جلب سجل تدقيق معين بواسطة الـ ID
exports.getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate('userId', 'name email role');
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. (اختياري) Endpoint لتسجيل Log يدوياً عبر الـ API لو تطلب الأمر
exports.logActionManual = async (req, res) => {
  try {
    const { action, entity, entityId, details } = req.body;
    const userId = req.user ? req.user.id : req.body.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';

    if (!userId || !action || !entity || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId, action, entity, and entityId'
      });
    }

    const log = new AuditLog({
      userId,
      action: action.toUpperCase(),
      entity,
      entityId,
      details,
      ipAddress
    });

    await log.save();

    res.status(201).json({
      success: true,
      message: 'Audit log recorded successfully',
      data: log
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};