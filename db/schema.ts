import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const salesUsers = sqliteTable("sales_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(), business: text("business").notNull(), contact: text("contact").notNull(), email: text("email").notNull(), phone: text("phone").notNull(), address: text("address").notNull(), updatedAt: integer("updated_at").notNull(),
});

export const products = sqliteTable("products", {
  sku: text("sku").primaryKey(), name: text("name").notNull(), category: text("category").notNull(), pack: text("pack").notNull(), price: integer("price_cents").notNull(), stock: integer("stock").notNull(), published: integer("published", { mode: "boolean" }).notNull(), updatedAt: integer("updated_at").notNull(),
});
