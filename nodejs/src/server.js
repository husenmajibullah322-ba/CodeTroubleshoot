const config = require("./config");
const { openDatabase } = require("./database/init");
const { createApp } = require("./app");

const db = openDatabase(config.dbPath);
const app = createApp(db);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
