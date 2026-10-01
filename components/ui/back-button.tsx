"use client";

import Link from "next/link";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// Client component so `component={Link}` can be passed to MUI's Button.
export function BackButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component={Link} href={href} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 3 }}>
      {children}
    </Button>
  );
}
