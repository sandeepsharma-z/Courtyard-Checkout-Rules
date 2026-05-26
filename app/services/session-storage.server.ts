import type { Session } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

import prisma, { ensureRuntimeDatabase } from "../db.server";

class RuntimePrismaSessionStorage implements SessionStorage {
  private storage: PrismaSessionStorage<typeof prisma> | null = null;

  private async getStorage() {
    await ensureRuntimeDatabase();

    if (!this.storage) {
      this.storage = new PrismaSessionStorage(prisma);
    }

    return this.storage;
  }

  async storeSession(session: Session) {
    return (await this.getStorage()).storeSession(session);
  }

  async loadSession(id: string) {
    return (await this.getStorage()).loadSession(id);
  }

  async deleteSession(id: string) {
    return (await this.getStorage()).deleteSession(id);
  }

  async deleteSessions(ids: string[]) {
    return (await this.getStorage()).deleteSessions(ids);
  }

  async findSessionsByShop(shop: string) {
    return (await this.getStorage()).findSessionsByShop(shop);
  }
}

export const sessionStorage = new RuntimePrismaSessionStorage();
