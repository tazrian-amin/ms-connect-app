"use client";

import Image from "next/image";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export function TopNav() {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar
        sx={{
          justifyContent: "space-between",
          gap: { xs: 1, sm: 2 },
          minHeight: { xs: 56, sm: 64 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Box
          component={Link}
          href="/"
          aria-label="MS Connect home"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, sm: 1.5 },
            minWidth: 0,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <Image
            src="/icons/icon.svg"
            alt=""
            width={36}
            height={36}
            style={{
              width: "clamp(28px, 8vw, 36px)",
              height: "auto",
              flexShrink: 0,
              borderRadius: 8,
              backgroundColor: "#FFFFFF",
            }}
            priority
          />
          <Typography
            variant="h6"
            component="span"
            noWrap
            sx={{ fontWeight: 700, fontSize: { xs: "1.0625rem", sm: "1.25rem" } }}
          >
            MS Connect
          </Typography>
        </Box>

        <Button
          variant="contained"
          disableElevation
          href="https://mining-sentry.com"
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon />}
          sx={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            minHeight: { xs: 36, sm: 40 },
            px: { xs: 1.5, sm: 2 },
            fontSize: { xs: "0.75rem", sm: "0.875rem" },
            "& .MuiButton-endIcon": { ml: { xs: 0.5, sm: 1 } },
            "& .MuiButton-endIcon > svg": { fontSize: { xs: 16, sm: 20 } },
          }}
        >
          Mining Sentry
        </Button>
      </Toolbar>
    </AppBar>
  );
}
