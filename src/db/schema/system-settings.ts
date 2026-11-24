import {
  mysqlTable,
  varchar,
  text,
  json,
  int,
  timestamp,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

export const systemSettings = mysqlTable("system_settings", {
  settingKey: varchar("setting_key", { length: 100 }).primaryKey(),
  settingValue: json("setting_value").notNull(),
  description: text("description"),
  updatedBy: int("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
