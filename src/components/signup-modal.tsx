"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const COUNTRY_CODES = [
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+34", label: "ES +34" },
  { code: "+52", label: "MX +52" },
  { code: "+33", label: "FR +33" },
  { code: "+49", label: "DE +49" },
  { code: "+39", label: "IT +39" },
  { code: "+55", label: "BR +55" },
  { code: "+57", label: "CO +57" },
  { code: "+54", label: "AR +54" },
  { code: "+56", label: "CL +56" },
  { code: "+51", label: "PE +51" },
  { code: "+58", label: "VE +58" },
  { code: "+81", label: "JP +81" },
  { code: "+82", label: "KR +82" },
  { code: "+86", label: "CN +86" },
  { code: "+91", label: "IN +91" },
  { code: "+61", label: "AU +61" },
  { code: "+64", label: "NZ +64" },
  { code: "+351", label: "PT +351" },
  { code: "+31", label: "NL +31" },
  { code: "+46", label: "SE +46" },
  { code: "+41", label: "CH +41" },
  { code: "+43", label: "AT +43" },
  { code: "+48", label: "PL +48" },
  { code: "+90", label: "TR +90" },
  { code: "+971", label: "AE +971" },
  { code: "+966", label: "SA +966" },
  { code: "+20", label: "EG +20" },
  { code: "+27", label: "ZA +27" },
  { code: "+234", label: "NG +234" },
  { code: "+254", label: "KE +254" },
];

type Status = "idle" | "loading" | "success" | "error" | "duplicate";

export default function SignUpModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [os, setOs] = useState<"ios" | "android">("ios");
  const [status, setStatus] = useState<Status>("idle");

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCountryCode("+1");
    setPhone("");
    setOs("ios");
    setStatus("idle");
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = /^\d{6,15}$/.test(phone.replaceAll(" ", ""));
  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    isValidEmail &&
    isValidPhone;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;
    setStatus("loading");

    const url = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    if (!url) {
      setStatus("error");
      return;
    }

    try {
      // Check for duplicate email via GET (readable response, no CORS issue)
      const check = await fetch(
        `${url}?email=${encodeURIComponent(email)}`
      );
      const checkData = await check.json();
      if (checkData.exists) {
        setStatus("duplicate");
        return;
      }

      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: `${countryCode}${phone}`,
          os,
        }),
      });
      setStatus("success");
      onSuccess?.();
    } catch {
      setStatus("error");
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  if (status === "success") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-white sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-black">
              ✓
            </div>
            <p className="text-lg font-medium">You&apos;re on the list!</p>
            <p className="text-sm text-neutral-400">
              We&apos;ll be in touch soon.
            </p>
            <Button
              variant="outline"
              className="mt-2 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-neutral-800 bg-neutral-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Sign Up</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Join the waitlist to get early access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName" className="text-neutral-300">
                First Name
              </Label>
              <Input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName" className="text-neutral-300">
                Last Name
              </Label>
              <Input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-neutral-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="phone" className="text-neutral-300">
              Phone
            </Label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-9 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-sm text-white outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555 123 4567"
                className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-neutral-300">Platform</Label>
            <div className="flex h-10 rounded-lg border border-neutral-700 bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => setOs("ios")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${
                  os === "ios"
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                iOS
              </button>
              <button
                type="button"
                onClick={() => setOs("android")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${
                  os === "android"
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.341a.96.96 0 0 0 .953-.957c0-.53-.426-.96-.953-.96a.96.96 0 0 0-.954.96.96.96 0 0 0 .954.957m-11.046 0a.96.96 0 0 0 .954-.957.96.96 0 0 0-.954-.96.96.96 0 0 0-.953.96.96.96 0 0 0 .953.957m11.4-6.5 1.996-3.46a.416.416 0 0 0-.152-.567.41.41 0 0 0-.563.154l-2.023 3.51a12.2 12.2 0 0 0-5.135-1.1c-1.84 0-3.55.394-5.135 1.1L4.84 4.968a.41.41 0 0 0-.563-.154.416.416 0 0 0-.152.567L6.12 8.84C2.53 10.836.436 14.18.094 18h23.812c-.34-3.82-2.435-7.164-6.029-9.159" />
                </svg>
                Android
              </button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-neutral-500">
            By submitting, you consent to receive text messages from ATTO
            SOUND, including waitlist updates and verification codes. Message
            and data rates may apply. Reply STOP to opt out. Consent is not a
            condition of any purchase. See our{" "}
            <Link
              href="/privacy"
              className="text-neutral-400 underline underline-offset-2 hover:text-white"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="text-neutral-400 underline underline-offset-2 hover:text-white"
            >
              Terms of Service
            </Link>
            .
          </p>

          <Button
            type="submit"
            disabled={!isFormValid || status === "loading"}
            className="mt-1 w-full bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {status === "loading" ? "Submitting..." : "Submit"}
          </Button>

          {status === "duplicate" && (
            <p className="text-center text-sm text-amber-400">
              This email is already on the waitlist.
            </p>
          )}
          {status === "error" && (
            <p className="text-center text-sm text-red-400">
              Something went wrong. Please try again.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
