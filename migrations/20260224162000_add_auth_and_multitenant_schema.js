/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.bigIncrements("id").primary();
    table.string("email", 191).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table.string("full_name", 191).nullable();
    table.enu("global_role", ["superadmin", "user"]).notNullable().defaultTo("user");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.dateTime("last_login_at", { precision: 3 }).nullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable("workspaces", (table) => {
    table.bigIncrements("id").primary();
    table.string("name", 191).notNullable();
    table.string("slug", 191).notNullable().unique();
    table.enu("status", ["active", "suspended"]).notNullable().defaultTo("active");
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable("workspace_members", (table) => {
    table.bigIncrements("id").primary();
    table.bigInteger("workspace_id").unsigned().notNullable();
    table.bigInteger("user_id").unsigned().notNullable();
    table.bigInteger("invited_by_user_id").unsigned().nullable();
    table.enu("role", ["owner", "admin", "agent", "viewer"]).notNullable().defaultTo("agent");
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table.unique(["workspace_id", "user_id"], "uk_workspace_member");
    table.index(["workspace_id"], "idx_workspace_members_workspace");
    table.index(["user_id"], "idx_workspace_members_user");

    table
      .foreign("workspace_id", "fk_workspace_members_workspace")
      .references("workspaces.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table
      .foreign("user_id", "fk_workspace_members_user")
      .references("users.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table
      .foreign("invited_by_user_id", "fk_workspace_members_invited_by")
      .references("users.id")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
  });

  await knex.schema.createTable("wa_channels", (table) => {
    table.bigIncrements("id").primary();
    table.bigInteger("workspace_id").unsigned().notNullable();
    table.string("name", 191).notNullable();
    table.enu("provider", ["whatsapp_cloud_api"]).notNullable().defaultTo("whatsapp_cloud_api");
    table.string("waba_id", 64).notNullable();
    table.string("phone_number_id", 64).notNullable();
    table.string("display_phone_number", 64).nullable();
    table.enu("status", ["active", "disabled"]).notNullable().defaultTo("active");
    table.bigInteger("created_by_user_id").unsigned().nullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table.unique(["phone_number_id"], "uk_wa_channels_phone_number_id");
    table.unique(["workspace_id", "name"], "uk_wa_channels_workspace_name");
    table.index(["workspace_id"], "idx_wa_channels_workspace");
    table.index(["waba_id"], "idx_wa_channels_waba_id");

    table
      .foreign("workspace_id", "fk_wa_channels_workspace")
      .references("workspaces.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table
      .foreign("created_by_user_id", "fk_wa_channels_created_by")
      .references("users.id")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
  });

  await knex.schema.createTable("channel_credentials_encrypted", (table) => {
    table.bigIncrements("id").primary();
    table.bigInteger("channel_id").unsigned().notNullable().unique();

    table.text("access_token_ciphertext").notNullable();
    table.string("access_token_iv", 255).notNullable();
    table.string("access_token_tag", 255).notNullable();

    table.text("app_secret_ciphertext").nullable();
    table.string("app_secret_iv", 255).nullable();
    table.string("app_secret_tag", 255).nullable();

    table.string("encryption_key_id", 64).notNullable();
    table.bigInteger("updated_by_user_id").unsigned().nullable();
    table.dateTime("rotated_at", { precision: 3 }).nullable();
    table.dateTime("created_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    table.dateTime("updated_at", { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    table
      .foreign("channel_id", "fk_channel_creds_channel")
      .references("wa_channels.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table
      .foreign("updated_by_user_id", "fk_channel_creds_updated_by")
      .references("users.id")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("channel_credentials_encrypted");
  await knex.schema.dropTableIfExists("wa_channels");
  await knex.schema.dropTableIfExists("workspace_members");
  await knex.schema.dropTableIfExists("workspaces");
  await knex.schema.dropTableIfExists("users");
};

