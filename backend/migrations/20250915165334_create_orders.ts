import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('orders', (table: Knex.TableBuilder) => {
    table.increments('id').primary();
    table.string('customer_name').notNullable();
    table.decimal('total_amount', 14, 2).defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('orders');
}