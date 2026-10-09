// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const drafts = sqliteTable('drafts', { id: text('id').primaryKey(), owner: text('owner').notNull(), document: text('document').notNull(), version: integer('version').notNull(), updated: text('updated').notNull() });
export const revisions = sqliteTable('revisions', { id: text('id').primaryKey(), draft: text('draft').notNull(), owner: text('owner').notNull(), document: text('document').notNull(), created: text('created').notNull() });
export const vault = sqliteTable('vault', { id: text('id').primaryKey(), owner: text('owner').notNull(), provider: text('provider').notNull(), ciphertext: text('ciphertext').notNull(), model: text('model').notNull() });
export const operations = sqliteTable('operations', { id: text('id').primaryKey(), owner: text('owner').notNull(), state: text('state').notNull(), result: text('result').notNull(), created: text('created').notNull() });
export const activity = sqliteTable('activity', { id: text('id').primaryKey(), owner: text('owner').notNull(), action: text('action').notNull(), detail: text('detail').notNull(), created: text('created').notNull() });
export const limits = sqliteTable('limits', { id:text('id').primaryKey(), count:integer('count').notNull() });
