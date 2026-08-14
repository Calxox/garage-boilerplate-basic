import type { Metadata } from "next";
import Link from "next/link";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Home",
  description: "Welcome to the app",
};

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.leftSide}>
        <div className={styles.content}>
          <h1>
            {process.env.NEXT_PUBLIC_APP_NAME ?? "App"}
          </h1>

          <p>
            Placeholder text
          </p>
        </div>
      </div>

      <div className={styles.rightSide}>
        <p className={styles.text}>Login</p>
        <Link href="/auth/signin" className={styles.signIn}>
          Sign in
        </Link>
        <p className={styles.text}>Create account</p>
        <Link href="/auth/signup" className={styles.signUp}>
          Create account
        </Link>
      </div>
    </main>
  );
}