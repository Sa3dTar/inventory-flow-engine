const express = require('express');
const router = express.Router();
const {
  createMovementItem,
  getItemsByMovement,
  getMovementItemById,
  updateMovementItem,
  deleteMovementItem
} = require('../controller/stockmovementItem.controller'); // تأكد من مسار الـ Controller حسب هيكل مشروعك

// 1. إضافة عنصر جديد لحركة مخزنية
router.post('/', createMovementItem);

// 2. جلب جميع العناصر التابعة لحركة مخزنية معينة (باستخدام معرف الحركة)
router.get('/movement/:movementId', getItemsByMovement);

// 3. جلب عنصر واحد تفصيلي برقم التعريف الخاص به
router.get('/:id', getMovementItemById);

// 4. تحديث عنصر معين
router.put('/:id', updateMovementItem);

// 5. حذف عنصر معين
router.delete('/:id', deleteMovementItem);

module.exports = router;