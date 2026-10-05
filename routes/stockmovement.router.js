const express = require('express');
const router = express.Router();
const {
  createStockMovement,
  getAllStockMovements,
  getStockMovementById,
  confirmStockMovement,
  cancelStockMovement
} = require('../controller/stockMovement.controller');

router.post('/', createStockMovement);
router.get('/', getAllStockMovements);
router.get('/:id', getStockMovementById);
router.put('/:id/confirm', confirmStockMovement);
router.put('/:id/cancel', cancelStockMovement);

module.exports = router;