require("./src/utils/loadEnv")();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "wa_webhook",
      charset: "utf8mb4",
    },
    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations",
    },
    pool: { min: 2, max: 10 },
  },
  production: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "wa_webhook",
      charset: "utf8mb4",
    },
    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations",
    },
    pool: { min: 2, max: 10 },
  },
};
