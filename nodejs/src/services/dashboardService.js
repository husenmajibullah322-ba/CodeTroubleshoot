function createCategoryService(repository) {
  function listCategories() {
    return repository.listCategories();
  }

  return { listCategories };
}

function createDashboardService(repository) {
  function getStats() {
    return repository.getStats();
  }

  return { getStats };
}

module.exports = { createCategoryService, createDashboardService };

