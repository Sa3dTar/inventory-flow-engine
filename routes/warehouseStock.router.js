const express = require('express');
const router = express.Router();
const {
  createWarehouseStock,
  getAllWarehouseStocks,
  getWarehouseStockById,
  updateWarehouseStock,
  deleteWarehouseStock
} = require('../controller/warehousestock.controller'); // تأكد من مسار الـ Controller

router.route('/')
  .post(createWarehouseStock)
  .get(getAllWarehouseStocks);

router.route('/:id')
  .get(getWarehouseStockById)
  .put(updateWarehouseStock)
  .delete(deleteWarehouseStock);

module.exports = router;