const { requiredAdjustment, parseId } = require("../middleware/validate");

function createStockService(repository) {
  function adjustStock(id, adjustment) {
    const parsed = parseId(id);
    if (parsed === null) {
      return null;
    }
    const delta = requiredAdjustment(adjustment);
    const book = repository.findById(parsed);
    if (!book) {
      return null;
    }
    const next = book.quantity + delta;
    if (next < 0) {
      const error = new Error("Insufficient stock");
      error.status = 400;
      throw error;
    }
    return repository.updateQuantity(parsed, next);
  }

  return { adjustStock };
}

module.exports = { createStockService };
