"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Link from "@mui/material/Link";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import { contactEmailHref, openContactEmail } from "@/lib/contact";
import { cancelDemoFeedbackOffer, closeDemoFeedback, useDemoFeedback } from "@/lib/demo-feedback";
import { getDevice } from "@/lib/homepage/devices";

const MESSAGE_MAX_LENGTH = 1_000;

/**
 * Asks how a demo went once the visitor has ended it (see lib/demo-feedback.ts), and offers to get
 * in touch. Sending opens the visitor's email app with everything filled in, so they see exactly
 * what goes out and can add to it.
 */
export function DemoFeedbackDialog() {
  const slug = useDemoFeedback();
  const deviceName = (slug && getDevice(slug)?.name) || null;

  // An offer still waiting when the page goes away is dropped rather than shown on the next one.
  useEffect(() => () => cancelDemoFeedbackOffer(), []);

  return (
    <Dialog open={deviceName !== null} onClose={() => closeDemoFeedback()} fullWidth maxWidth="sm">
      {deviceName && <FeedbackForm deviceName={deviceName} />}
    </Dialog>
  );
}

function FeedbackForm({ deviceName }: { deviceName: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [wantsToOrder, setWantsToOrder] = useState(false);
  const [hasQuestions, setHasQuestions] = useState(false);
  const filledIn = rating !== null || message.trim() !== "" || wantsToOrder || hasQuestions;

  const send = () => {
    const subject = wantsToOrder ? `Order enquiry: ${deviceName}` : `${deviceName} demo feedback`;
    openContactEmail(subject, [
      `Device: ${deviceName}`,
      rating !== null && `Demo rating: ${rating} out of 5`,
      wantsToOrder && `I'd like to order this device.`,
      hasQuestions && `I have questions about other devices.`,
      message.trim() && `\n${message.trim()}`,
      "\nSent from the MS Connect app demo.",
    ]);
    closeDemoFeedback();
  };

  return (
    <>
      <DialogTitle>How was the {deviceName} demo?</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Thanks for trying it. Tell us what you think, or get in touch if you&apos;d like one for your site.
          </Typography>
          <Box>
            <Typography component="legend" variant="body2" sx={{ mb: 0.5 }}>
              Your rating
            </Typography>
            <Rating name="demo-rating" value={rating} onChange={(_, value) => setRating(value)} size="large" />
          </Box>
          <TextField
            label="Anything you'd like to tell us? (optional)"
            multiline
            minRows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          />
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={wantsToOrder} onChange={(event) => setWantsToOrder(event.target.checked)} />}
              label={`I'd like to order the ${deviceName}`}
            />
            <FormControlLabel
              control={<Checkbox checked={hasQuestions} onChange={(event) => setHasQuestions(event.target.checked)} />}
              label="I have questions about other devices"
            />
          </FormGroup>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Prefer to write yourself? <Link href={contactEmailHref()}>Contact Sales</Link>.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button color="inherit" size="small" onClick={() => closeDemoFeedback(true)} sx={{ mr: "auto" }}>
          Don&apos;t ask again
        </Button>
        <Button color="inherit" onClick={() => closeDemoFeedback()}>
          Not now
        </Button>
        <Button variant="contained" disableElevation startIcon={<MailOutlineIcon />} disabled={!filledIn} onClick={send}>
          Email us
        </Button>
      </DialogActions>
    </>
  );
}
