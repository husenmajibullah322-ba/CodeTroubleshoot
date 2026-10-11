const express = require("express");

function createBooksRouter(controller) {
  const router = express.Router();
  router.get("/", controller.list);
  router.get("/search", controller.search);
  router.get("/:id", controller.getById);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);
  router.patch("/:id/stock", controller.adjustStock);
  return router;
}

module.exports = { createBooksRouter };
