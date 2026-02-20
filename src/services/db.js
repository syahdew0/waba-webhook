const knex = require("knex");

let instance;

function getDb() {
  if (!instance) {
    instance = knex(require("../../knexfile").development);
  }
  return instance;
}

module.exports = { getDb };
