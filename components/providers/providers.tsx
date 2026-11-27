"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";

/*
 * The brand yellow is too light to read as text on a light background (1.6:1; WCAG AA needs 4.5:1),
 * so where MUI would colour text with it in the light theme (links, text and outlined buttons,
 * the selected tab), it uses this darker gold instead (5.3:1 on #fafafa). Yellow fills, such as
 * contained buttons with black text, and everything in the dark theme are unchanged.
 */
const PRIMARY_TEXT_ON_LIGHT = "#856400";

// Palette mirrors the tokens in globals.css. MUI toggles a `light`/`dark` class
// on <html> (following the system by default, or the user's choice from the
// theme toggle), and the CSS tokens key off the same class.
const theme = createTheme({
  components: {
    MuiLink: {
      styleOverrides: {
        root: ({ ownerState, theme }) =>
          ownerState.color === "primary"
            ? theme.applyStyles("light", {
                color: PRIMARY_TEXT_ON_LIGHT,
                textDecorationColor: `color-mix(in srgb, ${PRIMARY_TEXT_ON_LIGHT} 40%, transparent)`,
              })
            : {},
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState, theme }) =>
          ownerState.color === "primary" && ownerState.variant !== "contained"
            ? theme.applyStyles("light", {
                color: PRIMARY_TEXT_ON_LIGHT,
                ...(ownerState.variant === "outlined" && {
                  borderColor: `color-mix(in srgb, ${PRIMARY_TEXT_ON_LIGHT} 50%, transparent)`,
                }),
              })
            : {},
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => theme.applyStyles("light", { "&.Mui-selected": { color: PRIMARY_TEXT_ON_LIGHT } }),
      },
    },
  },
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
