"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Palette mirrors the tokens in globals.css. MUI toggles a `light`/`dark` class
// on <html> (following the system by default, or the user's choice from the
// theme toggle), and the CSS tokens key off the same class.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#ffc502", contrastText: "#000000" },
        secondary: { main: "#191919", contrastText: "#ffffff" },
        background: { default: "#fafafa", paper: "#ffffff" },
        text: { primary: "#18181b" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#ffc502", contrastText: "#000000" },
        secondary: { main: "#ffffff", contrastText: "#000000" },
        background: { default: "#09090b", paper: "#18181b" },
        text: { primary: "#fafafa" },
      },
    },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
