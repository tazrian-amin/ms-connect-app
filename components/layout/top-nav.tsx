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
      <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
        <Box
          component={Link}
          href="/"
          aria-label="MS Connect home"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <Image
            src="/icons/icon.svg"
            alt=""
            width={36}
            height={36}
            style={{ borderRadius: 8, backgroundColor: "#FFFFFF" }}
            priority
          />
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
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
        >
          Mining Sentry
        </Button>
      </Toolbar>
    </AppBar>
  );
}
