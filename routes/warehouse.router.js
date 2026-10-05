const express = require('express');
const router = express.Router();
const {
  createWarehouse,
  getAllWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse
} = require('../controller/warehouse.controller');

// تحديد المسارات (Endpoints)
router.route('/')
  .post(createWarehouse)    // POST /api/warehouses
  .get(getAllWarehouses);   // GET /api/warehouses

router.route('/:id')
  .get(getWarehouseById)    // GET /api/warehouses/:id
  .put(updateWarehouse)     // PUT /api/warehouses/:id
  .delete(deleteWarehouse); // DELETE /api/warehouses/:id

module.exports = router;