"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import { MuiTelInput, matchIsValidTel } from "mui-tel-input";
import { contactEmailHref, openContactEmail } from "@/lib/contact";
import { devices } from "./devices";

const MESSAGE_MAX_LENGTH = 2_000;
const FIELD_MAX_LENGTH = 100;

const topics = [
  { id: "learn", label: "Learn more", subject: "Enquiry" },
  { id: "order", label: "Place an order", subject: "Order enquiry" },
  { id: "custom", label: "Customization", subject: "Customization request" },
  { id: "feedback", label: "Feedback", subject: "Feedback" },
  { id: "other", label: "Something else", subject: "Message" },
] as const;

type TopicId = (typeof topics)[number]["id"];

/**
 * The homepage's invitation to get in touch: to learn about or order devices the visitor doesn't
 * have yet, ask for something made to their needs, or share feedback. Sending opens the visitor's
 * email app with the message filled in (see lib/contact.ts).
 */
export function ContactSection() {
  const [topic, setTopic] = useState<TopicId>("learn");
  const [interested, setInterested] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneEntered, setPhoneEntered] = useState(false);
  const [message, setMessage] = useState("");
  const chosenTopic = topics.find(({ id }) => id === topic) ?? topics[0];
  const chosenDevices = devices.filter(({ slug }) => interested.includes(slug));
  const filledIn = message.trim() !== "" || chosenDevices.length > 0;
  // The picker leaves the calling code (e.g. "+1") in the value, so only a typed number counts as entered.
  const phoneInvalid = phoneEntered && !matchIsValidTel(phone);

  const send = () => {
    const about = chosenDevices.length === 1 ? `: ${chosenDevices[0].name}` : "";
    openContactEmail(`${chosenTopic.subject}${about}`, [
      `Topic: ${chosenTopic.label}`,
      chosenDevices.length > 0 && `Devices: ${chosenDevices.map((device) => device.name).join(", ")}`,
      name.trim() && `Name: ${name.trim()}`,
      company.trim() && `Company: ${company.trim()}`,
      phoneEntered && `Phone: ${phone}`,
      message.trim() && `\n${message.trim()}`,
      "\nSent from the MS Connect app.",
    ]);
  };

  return (
    <Card
      component="section"
      aria-labelledby="contact-us"
      variant="outlined"
      sx={{ mt: { xs: 5, sm: 6 }, borderRadius: 2, p: { xs: 2, sm: 3, md: 4 } }}
    >
      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, md: 6 },
          // minmax(0, …) lets columns shrink below their content, so a long device selection truncates
          // instead of widening the card past the screen.
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 3fr)" },
        }}
      >
        <Stack spacing={1.5}>
          <Typography
            id="contact-us"
            variant="h5"
            component="h2"
            sx={{ fontWeight: 500, fontSize: { xs: "1.125rem", sm: "1.25rem" } }}
          >
            Get in Touch
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: { xs: "0.9375rem", sm: "1rem" } }}>
            Interested in a device you don&apos;t have yet? Want to place an order, need something customized for
            your site, or have feedback for us? Tell us and we&apos;ll get back to you.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Prefer to write yourself? <Link href={contactEmailHref()}>Contact Sales</Link>.
          </Typography>
        </Stack>

        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="What can we help with?"
              value={topic}
              onChange={(event) => setTopic(event.target.value as TopicId)}
              fullWidth
            >
              {topics.map(({ id, label }) => (
                <MenuItem key={id} value={id}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Devices (optional)"
              value={interested}
              onChange={(event) => {
                const { value } = event.target as { value: string | string[] };
                setInterested(typeof value === "string" ? value.split(",") : value);
              }}
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: () => chosenDevices.map((device) => device.name).join(", "),
                },
              }}
              fullWidth
            >
              {devices.map(({ slug, name: deviceName }) => (
                <MenuItem key={slug} value={slug}>
                  <Checkbox checked={interested.includes(slug)} size="small" sx={{ py: 0, pl: 0 }} />
                  <ListItemText primary={deviceName} />
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Your name (optional)"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, FIELD_MAX_LENGTH))}
              autoComplete="name"
              fullWidth
            />
            <TextField
              label="Company (optional)"
              value={company}
              onChange={(event) => setCompany(event.target.value.slice(0, FIELD_MAX_LENGTH))}
              autoComplete="organization"
              fullWidth
            />
          </Stack>

          <MuiTelInput
            label="Phone (optional)"
            defaultCountry="US"
            value={phone}
            onChange={(value, info) => {
              setPhone(value);
              setPhoneEntered(Boolean(info.nationalNumber));
            }}
            error={phoneInvalid}
            helperText={phoneInvalid ? "Enter a valid phone number, or leave it blank." : undefined}
            autoComplete="tel"
            fullWidth
          />

          <TextField
            label="Message"
            placeholder="Tell us what you need, e.g. quantities, your site, or the changes you'd like."
            multiline
            minRows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          />

          <Box>
            <Button
              variant="contained"
              disableElevation
              size="large"
              startIcon={<MailOutlineIcon />}
              disabled={!filledIn || phoneInvalid}
              onClick={send}
            >
              Email us
            </Button>
            <Typography variant="caption" component="p" sx={{ color: "text.secondary", mt: 1 }}>
              Opens your email app with your message filled in. Nothing is sent until you press send there.
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Card>
  );
}

