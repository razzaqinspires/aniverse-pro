// NextAuth route handler factory — kept out of the app/api tree so route.ts can re-export cleanly.
import NextAuth from "next-auth";
import { authOptions } from "./auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
