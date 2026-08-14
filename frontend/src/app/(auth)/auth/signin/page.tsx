"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  loginSchema,
  type LoginInput,
} from "@/lib/validations/auth";

import { FullPageSpinner } from "@/components/shared/LoadingSpinner";

import styles from "./signin.module.css";

export default function SignInPage() {
  const router = useRouter();

  const {
    user,
    loading,
    signInWithEmail,
  } = useAuth();

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("verification") === "sent") {
      toast.success(
        "Verification email sent. Verify your email, then sign in."
      );
    }
  }, []);

  if (loading) {
    return <FullPageSpinner />;
  }

  const onSubmit = async (data: LoginInput) => {
    try {
      await signInWithEmail(
        data.email,
        data.password
      );

      toast.success("Signed in successfully");

      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("email-not-verified")
      ) {
        toast.error(
          "Please verify your email before signing in."
        );
      } else {
        toast.error(
          "Invalid email or password"
        );
      }
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.leftSide}>
      </section>
      <section className={styles.rightSide}>
        <div className={styles.loginCard}>
          <h1 className={styles.title}>
            Welcome
          </h1>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={styles.form}
          >
            <div className={styles.field}>
              <label
                htmlFor="email"
                className={styles.label}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email
                    ? "email-error"
                    : undefined
                }
                className={styles.input}
                {...register("email")}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className={styles.error}
                  role="alert"
                >
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className={styles.field}>
              <label
                htmlFor="password"
                className={styles.label}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password
                    ? "password-error"
                    : undefined
                }
                className={styles.input}
                {...register("password")}
              />
              {errors.password && (
                <p
                  id="password-error"
                  className={styles.error}
                  role="alert"
                >
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className={styles.options}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                />
                <span>
                  Remember me
                </span>
              </label>
              <Link
                href="/auth/signin"
                className={styles.forgot}
              >
                Forgot password?
              </Link>

            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.signIn}
            >
              {isSubmitting
                ? "Signing in…"
                : "Sign in"}
            </button>

          </form>
          <p className={styles.note}>
            Authentication behaviour remains unchanged
          </p>
          <p className={styles.signup}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup">
              Create account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}