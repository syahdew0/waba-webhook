/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("webhook_events", (table) => {
    table.bigIncrements("id").primary();
    table.dateTime("received_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.string("object", 100).nullable();
    table.string("event_source", 64).notNullable().defaultTo("whatsapp_cloud_api");
    table.json("payload").notNullable();
    table.string("payload_hash", 64).nullable();
    table.string("signature", 255).nullable();
    table.boolean("processed").notNullable().defaultTo(false);
    table.text("process_error").nullable();

    table.index(["received_at"], "idx_webhook_events_received_at");
    table.index(["object"], "idx_webhook_events_object");
  });

  await knex.schema.createTable("dedupe_keys", (table) => {
    table.string("dedupe_key", 255).primary();
    table.dateTime("first_seen_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("expires_at", { precision: 3 }).nullable();

    table.index(["expires_at"], "idx_dedupe_keys_expires_at");
  });

  await knex.schema.createTable("wa_contacts", (table) => {
    table.string("wa_id", 32).primary();
    table.string("profile_name", 255).nullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable("wa_messages", (table) => {
    table.string("message_id", 191).primary();
    table.enu("direction", ["inbound", "outbound"]).notNullable();
    table.string("phone_number_id", 64).notNullable();
    table.string("wa_id", 32).notNullable();
    table.string("message_type", 50).notNullable();
    table.text("text_body").nullable();
    table.string("interactive_type", 50).nullable();
    table.string("interactive_id", 191).nullable();
    table.string("interactive_title", 255).nullable();
    table.string("context_message_id", 191).nullable();
    table.dateTime("message_ts", { precision: 3 }).nullable();
    table.json("raw_message").notNullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table
      .foreign("wa_id", "fk_wa_messages_contact")
      .references("wa_contacts.wa_id")
      .onDelete("RESTRICT")
      .onUpdate("CASCADE");

    table.index(["wa_id", "message_ts"], "idx_wa_messages_wa_id_ts");
    table.index(["phone_number_id", "message_ts"], "idx_wa_messages_phone_ts");
    table.index(["message_type"], "idx_wa_messages_type");
  });

  await knex.schema.createTable("wa_message_status_events", (table) => {
    table.bigIncrements("id").primary();
    table.string("message_id", 191).notNullable();
    table.enu("status", ["sent", "delivered", "read", "failed"]).notNullable();
    table.string("recipient_wa_id", 32).nullable();
    table.dateTime("status_ts", { precision: 3 }).nullable();
    table.json("conversation").nullable();
    table.json("pricing").nullable();
    table.json("errors").nullable();
    table.json("raw_status").notNullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table
      .foreign("message_id", "fk_status_message")
      .references("wa_messages.message_id")
      .onDelete("RESTRICT")
      .onUpdate("CASCADE");

    table.unique(["message_id", "status", "status_ts"], {
      indexName: "uk_message_status_ts",
    });
    table.index(["message_id"], "idx_wa_status_message_id");
    table.index(["status_ts"], "idx_wa_status_ts");
  });

  await knex.schema.createTable("wa_message_status_latest", (table) => {
    table.string("message_id", 191).primary();
    table.enu("latest_status", ["sent", "delivered", "read", "failed"]).notNullable();
    table.dateTime("latest_status_ts", { precision: 3 }).nullable();
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table
      .foreign("message_id", "fk_latest_message")
      .references("wa_messages.message_id")
      .onDelete("RESTRICT")
      .onUpdate("CASCADE");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("wa_message_status_latest");
  await knex.schema.dropTableIfExists("wa_message_status_events");
  await knex.schema.dropTableIfExists("wa_messages");
  await knex.schema.dropTableIfExists("wa_contacts");
  await knex.schema.dropTableIfExists("dedupe_keys");
  await knex.schema.dropTableIfExists("webhook_events");
};
