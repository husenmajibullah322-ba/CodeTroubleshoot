function createBookRepository(db) {
  function findAll({ q, category } = {}) {
    const conditions = [];
    const params = [];
    if (q) {
      const escaped = q.replace(/[%_\\]/g, "\\$&");
      const like = `%${escaped}%`;
      conditions.push("(title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' OR isbn LIKE ? ESCAPE '\\')");
      params.push(like, like, like);
    }
    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return db.prepare(`SELECT * FROM books ${where} ORDER BY id`).all(...params);
  }

  function findById(id) {
    return db.prepare("SELECT * FROM books WHERE id = ?").get(id) || null;
  }

  function create(book) {
    try {
      const result = db
        .prepare(
          `INSERT INTO books (title, author, isbn, category, published_year, price, quantity)
           VALUES (@title, @author, @isbn, @category, @published_year, @price, @quantity)`
        )
        .run(book);
      return findById(Number(result.lastInsertRowid));
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const conflict = new Error("ISBN already exists");
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }
  }

  function update(id, fields) {
    try {
      const result = db
        .prepare(
          `UPDATE books
           SET title = @title,
               author = @author,
               isbn = @isbn,
               category = @category,
               published_year = @published_year,
               price = @price,
               quantity = @quantity,
               updated_at = datetime('now')
           WHERE id = @id`
        )
        .run({ ...fields, id });
      if (result.changes === 0) {
        return null;
      }
      return findById(id);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const conflict = new Error("ISBN already exists");
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }
  }

  function remove(id) {
    const result = db.prepare("DELETE FROM books WHERE id = ?").run(id);
    return result.changes > 0;
  }

  function updateQuantity(id, quantity) {
    const result = db
      .prepare("UPDATE books SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
      .run(quantity, id);
    if (result.changes === 0) {
      return null;
    }
    return findById(id);
  }

  function search(q) {
    return findAll({ q });
  }

  return { findAll, findById, create, update, remove, updateQuantity, search };
}

function isUniqueConstraint(error) {
  return error.errcode === 2067 || /UNIQUE constraint failed/i.test(error.message || "");
}

module.exports = { createBookRepository };
