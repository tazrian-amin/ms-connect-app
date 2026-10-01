"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Palette mirrors the tokens in globals.css. With CSS variables and both color
// schemes defined, MUI follows prefers-color-scheme, same as the CSS tokens.
const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#ffc500", contrastText: "#000000" },
        secondary: { main: "#000000", contrastText: "#ffffff" },
        background: { default: "#fafafa", paper: "#ffffff" },
        text: { primary: "#18181b" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#ffc500", contrastText: "#000000" },
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
