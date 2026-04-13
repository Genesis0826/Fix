"use client";

import { Button } from "@/components/ui/button";

interface GoogleSignInButtonProps {
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

// Official Google logo SVG — inline, no CDN or external dependency needed
function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.04 29.53 1 24 1 14.82 1 7.02 6.48 3.58 14.28l7.08 5.5C12.38 13.62 17.72 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.67c-.55 2.97-2.2 5.48-4.67 7.17l7.18 5.57C43.38 37.33 46.52 31.36 46.52 24.5z" />
      <path fill="#FBBC05" d="M10.66 28.22A14.6 14.6 0 0 1 9.5 24c0-1.47.25-2.89.66-4.22l-7.08-5.5A23.93 23.93 0 0 0 0 24c0 3.87.93 7.53 2.58 10.72l8.08-6.5z" />
      <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.18-5.57C28.6 37.84 26.42 38.5 24 38.5c-6.28 0-11.62-4.12-13.34-9.78l-8.08 6.5C6.02 42.52 14.45 47 24 47z" />
    </svg>
  );
}

export function GoogleSignInButton({ disabled, onClick }: Readonly<GoogleSignInButtonProps>) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-3 h-10 border-primary/30 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary font-medium text-sm transition-colors"
      disabled={disabled}
      onClick={onClick}
      aria-label="Sign in with Google"
    >
      <GoogleLogo />
      <span>Sign in with Google</span>
    </Button>
  );
}
