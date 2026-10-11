const totalCount = document.querySelector("#total-count");
const stats = document.querySelector("#stats");
const searchInput = document.querySelector("#search");
const categorySelect = document.querySelector("#category");
const addButton = document.querySelector("#add-book");
const bookRows = document.querySelector("#book-rows");
const message = document.querySelector("#message");
const dialog = document.querySelector("#book-dialog");
const dialogError = document.querySelector("#dialog-error");
const form = document.querySelector("#book-form");
const formTitle = document.querySelector("#form-title");
const cancelButton = document.querySelector("#cancel-form");

const booksById = new Map();
let editingId = null;
let latestRequest = 0;
let searchDebounce = null;

function init() {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      loadBooks(searchInput.value.trim());
    }, 200);
  });
  categorySelect.addEventListener("change", () => {
    loadBooks();
  });
  addButton.addEventListener("click", () => {
    openCreate();
  });
  cancelButton.addEventListener("click", () => {
    if (dialogError) dialogError.textContent = "";
    dialog.close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveBook();
  });
  bookRows.addEventListener("click", onRowClick);
  refresh();
}

async function refresh() {
  await Promise.all([loadStats(), loadCategories(), loadBooks()]);
}

async function loadStats() {
  const response = await fetch("/api/dashboard/stats");
  const data = await readJson(response);
  if (!response.ok) {
    showError(data.error);
    return;
  }
  totalCount.textContent = `${data.total_books} ${data.total_books === 1 ? "title" : "titles"}`;
  const categoryItems = data.books_by_category
    .map((item) => `<li><span>${escapeHtml(item.category)}</span><strong>${item.count}</strong></li>`)
    .join("");
  stats.innerHTML = `
    <article class="stat-card"><span>Titles</span><strong>${data.total_books}</strong></article>
    <article class="stat-card"><span>Copies in stock</span><strong>${data.available_copies}</strong></article>
    <article class="stat-card"><span>By category</span><ul class="stat-list">${categoryItems}</ul></article>
  `;
}

async function loadCategories() {
  const response = await fetch("/api/categories");
  const data = await readJson(response);
  if (!response.ok) {
    showError(data.error);
    return;
  }
  const current = categorySelect.value;
  categorySelect.innerHTML = `<option value="">All categories</option>${data
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
  categorySelect.value = data.includes(current) ? current : "";
}

async function loadBooks(query = searchInput.value.trim()) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (categorySelect.value) {
    params.set("category", categorySelect.value);
  }
  const requestId = ++latestRequest;
  const response = await fetch(`/api/books?${params.toString()}`);
  const data = await readJson(response);
  if (requestId !== latestRequest) {
    return;
  }
  if (!response.ok) {
    showError(data.error);
    return;
  }
  renderBooks(data);
}

function renderBooks(books) {
  booksById.clear();
  if (!books.length) {
    bookRows.innerHTML = `<tr><td colspan="7">No books found.</td></tr>`;
    return;
  }
  bookRows.innerHTML = books
    .map((book) => {
      booksById.set(String(book.id), book);
      return `<tr>
        <td>${escapeHtml(book.title)}</td>
        <td>${escapeHtml(book.author)}</td>
        <td>${escapeHtml(book.category)}</td>
        <td>${book.published_year}</td>
        <td>${Number(book.price).toFixed(2)}</td>
        <td>
          <span class="stock-controls">
            <button type="button" class="secondary" data-action="decrease" data-id="${book.id}" aria-label="Decrease stock" ${book.quantity === 0 ? "disabled" : ""}>-</button>
            <span>${book.quantity}</span>
            <button type="button" class="secondary" data-action="increase" data-id="${book.id}" aria-label="Increase stock">+</button>
          </span>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="secondary" data-action="edit" data-id="${book.id}">Edit</button>
            <button type="button" class="danger" data-action="delete" data-id="${book.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function onRowClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === "edit") {
    openEdit(id);
  } else if (action === "delete") {
    deleteBook(id);
  } else if (action === "increase") {
    adjustStock(id, 1);
  } else if (action === "decrease") {
    adjustStock(id, -1);
  }
}

function openCreate() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Add book";
  if (dialogError) dialogError.textContent = "";
  message.textContent = "";
  dialog.showModal();
}

function openEdit(id) {
  const book = booksById.get(String(id));
  if (!book) {
    return;
  }
  editingId = book.id;
  formTitle.textContent = "Edit book";
  form.elements.title.value = book.title;
  form.elements.author.value = book.author;
  form.elements.isbn.value = book.isbn;
  form.elements.category.value = book.category;
  form.elements.published_year.value = book.published_year;
  form.elements.price.value = book.price;
  form.elements.quantity.value = book.quantity;
  if (dialogError) dialogError.textContent = "";
  message.textContent = "";
  dialog.showModal();
}

async function saveBook() {
  const yearVal = form.elements.published_year.value.trim();
  const priceVal = form.elements.price.value.trim();
  const qtyVal = form.elements.quantity.value.trim();

  const payload = {
    title: form.elements.title.value.trim(),
    author: form.elements.author.value.trim(),
    isbn: form.elements.isbn.value.trim(),
    category: form.elements.category.value.trim(),
    published_year: yearVal === "" ? undefined : Number(yearVal),
    price: priceVal === "" ? undefined : Number(priceVal),
    quantity: qtyVal === "" ? undefined : Number(qtyVal),
  };
  try {
    const response = await fetch(editingId ? `/api/books/${editingId}` : "/api/books", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const errText = data.error || "Save failed";
      if (dialogError) dialogError.textContent = errText;
      showError(errText);
      return;
    }
    dialog.close();
    if (dialogError) dialogError.textContent = "";
    message.textContent = "";
    await refresh();
  } catch (err) {
    const netErr = "Network error: failed to save book";
    if (dialogError) dialogError.textContent = netErr;
    showError(netErr);
  }
}

async function deleteBook(id) {
  const book = booksById.get(String(id));
  if (!book || !window.confirm(`Delete ${book.title}?`)) {
    return;
  }
  try {
    const response = await fetch(`/api/books/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await readJson(response);
      showError(data.error);
      return;
    }
    message.textContent = "";
    await refresh();
  } catch (err) {
    showError("Network error: failed to delete book");
  }
}

async function adjustStock(id, adjustment) {
  try {
    const response = await fetch(`/api/books/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustment }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      showError(data.error);
      return;
    }
    message.textContent = "";
    await refresh();
  } catch (err) {
    showError("Network error: failed to adjust stock");
  }
}

async function readJson(response) {
  if (response.status === 204) {
    return {};
  }
  try {
    return await response.json();
  } catch {
    return { error: response.statusText || `Request failed with status ${response.status}` };
  }
}

function showError(text) {
  message.textContent = text || "Request failed";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
