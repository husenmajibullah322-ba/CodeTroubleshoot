function createStatsRepository(db) {
  function getStats() {
    const totals = db
      .prepare(
        `SELECT
           COUNT(*) AS total_books,
           COALESCE(SUM(quantity), 0) AS available_copies
         FROM books`
      )
      .get();
    const booksByCategory = db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM books
         GROUP BY category
         ORDER BY category`
      )
      .all();
    return {
      total_books: totals.total_books,
      available_copies: totals.available_copies,
      books_by_category: booksByCategory,
    };
  }

  function listCategories() {
    return db
      .prepare("SELECT DISTINCT category FROM books ORDER BY category")
      .all()
      .map((row) => row.category);
  }

  return { getStats, listCategories };
}

module.exports = { createStatsRepository };
