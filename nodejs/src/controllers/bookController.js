function createBookController(bookService, stockService) {
  function list(req, res, next) {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
      const books = bookService.listBooks({
        q: q || undefined,
        category: category || undefined,
      });
      res.json(books);
    } catch (error) {
      next(error);
    }
  }

  function search(req, res, next) {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      res.json(bookService.searchBooks(q));
    } catch (error) {
      next(error);
    }
  }

  function getById(req, res, next) {
    try {
      const book = bookService.getBook(req.params.id);
      if (!book) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.json(book);
    } catch (error) {
      next(error);
    }
  }

  function create(req, res, next) {
    try {
      const book = bookService.createBook(req.body || {});
      res.status(201).json(book);
    } catch (error) {
      next(error);
    }
  }

  function update(req, res, next) {
    try {
      const body = req.body || {};
      const book = bookService.updateBook(
        req.params.id,
        body.title,
        body.author,
        body.isbn,
        body.category,
        body.published_year,
        body.price,
        body.quantity
      );
      if (!book) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.json(book);
    } catch (error) {
      next(error);
    }
  }

  function remove(req, res, next) {
    try {
      const removed = bookService.deleteBook(req.params.id);
      if (!removed) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  function adjustStock(req, res, next) {
    try {
      const book = stockService.adjustStock(req.params.id, (req.body || {}).adjustment);
      if (!book) {
        res.status(404).json({ error: "Book not found" });
        return;
      }
      res.json(book);
    } catch (error) {
      next(error);
    }
  }

  return { list, search, getById, create, update, remove, adjustStock };
}

module.exports = { createBookController };
