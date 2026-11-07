// NextAuth (Auth.js v4) configuration.
// - Google OAuth provider (active only when GOOGLE_CLIENT_ID/SECRET are set — optional).
// - Demo Credentials provider: zero-setup login for testing/presentation. Creates a demo user
//   with is_demo=true, fully separated from Google users. This is the DEFAULT login path.
// Session is JWT (short-lived via maxAge), cookies are HttpOnly+SameSite=Lax (Secure in prod).

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateUser } from "./db";
import { config, isGoogleConfigured } from "./config";

export const DEMO_USER_ID = "demo-user";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7d refresh-style; access-level checks done per-request
  jwt: { maxAge: 15 * 60 }, // short-lived access token (15m), auto-rotated by next-auth
  secret: config.nextauthSecret,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "demo",
      name: "Demo / Guest",
      credentials: {}, // no fields — one click login
      async authorize() {
        await getOrCreateUser(DEMO_USER_ID, {
          email: "demo@aniverse.local",
          name: "Tamu Demo",
          image: null,
          isDemo: true,
        });
        return { id: DEMO_USER_ID, name: "Tamu Demo", email: "demo@aniverse.local", isDemo: true } as any;
      },
    }),
    ...(isGoogleConfigured()
      ? [
          GoogleProvider({
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
            authorization: { params: { scope: "openid email profile", code_challenge_method: "S256" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.uid = (user as any).id;
        token.isDemo = (user as any).isDemo === true || (account?.provider === "demo");
      }
      // Ensure user row exists for Google logins (created on first sign-in via signIn callback below).
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.uid as string;
      (session.user as any).isDemo = Boolean(token.isDemo);
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user) {
        await getOrCreateUser(`google-${user.id ?? user.email}`, {
          email: user.email ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
          isDemo: false,
        });
      }
      return true;
    },
  },
};

export function getDemoUserId(): string {
  return DEMO_USER_ID;
}
