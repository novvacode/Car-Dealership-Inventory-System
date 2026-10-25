import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, ErrorAlert } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { AuthLayout } from "./AuthLayout";

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain a letter and a number.";
  return null;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem =
      (!form.full_name.trim() && "Please enter your name.") ||
      validatePassword(form.password) ||
      (form.password !== form.confirm && "Passwords do not match.");
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      toast.success("Account created. Welcome to Apex Motors!");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Browse the full inventory and purchase vehicles.">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label htmlFor="full_name" className="label">Full name</label>
          <input id="full_name" autoComplete="name" required maxLength={100} className="input" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="new-password" required className="input" value={form.password} onChange={set("password")} aria-describedby="password-hint" />
          <p id="password-hint" className="mt-1 text-xs text-stone-500">At least 8 characters, including a letter and a number.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" required className="input" value={form.confirm} onChange={set("confirm")} />
        </div>
        <Button type="submit" className="w-full py-2.5" loading={submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent-600 hover:text-accent-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
