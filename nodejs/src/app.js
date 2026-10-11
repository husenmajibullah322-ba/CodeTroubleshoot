const path = require("path");
const express = require("express");
const { createBookRepository } = require("./repositories/bookRepository");
const { createStatsRepository } = require("./repositories/statsRepository");
const { createBookService } = require("./services/bookService");
const { createStockService } = require("./services/stockService");
const { createCategoryService, createDashboardService } = require("./services/dashboardService");
const { createBookController } = require("./controllers/bookController");
const { createCategoryController, createDashboardController } = require("./controllers/catalogController");
const { createBooksRouter } = require("./routes/books");
const { createCategoriesRouter, createDashboardRouter } = require("./routes/catalog");
const { errorHandler } = require("./middleware/errorHandler");

function createApp(db) {
  const books = createBookRepository(db);
  const stats = createStatsRepository(db);
  const bookService = createBookService(books);
  const stockService = createStockService(books);
  const categoryService = createCategoryService(stats);
  const dashboardService = createDashboardService(stats);
  const bookController = createBookController(bookService, stockService);
  const categoryController = createCategoryController(categoryService);
  const dashboardController = createDashboardController(dashboardService);

  const app = express();
  app.use(express.json());
  app.use("/api/books", createBooksRouter(bookController));
  app.use("/api/categories", createCategoriesRouter(categoryController));
  app.use("/api/dashboard", createDashboardRouter(dashboardController));
  app.use(express.static(path.join(__dirname, "..", "frontend")));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
