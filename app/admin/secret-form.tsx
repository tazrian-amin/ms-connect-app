"use client";

import { startTransition, useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { setSitePassword, type FormState } from "./actions";

type SecretFormProps = {
  title: string;
  description: string;
  status: string;
};

type PasswordFieldProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

/** A password input with a button that shows what was typed. */
function PasswordField({ name, label, value, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`;

  return (
    <TextField
      name={name}
      type={visible ? "text" : "password"}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="new-password"
      required
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={toggleLabel}
                aria-pressed={visible}
                onClick={() => setVisible((shown) => !shown)}
                // Keeps the cursor in the field when the button is clicked.
                onMouseDown={(event) => event.preventDefault()}
                edge="end"
              >
                {visible ? <VisibilityOutlinedIcon /> : <VisibilityOffOutlinedIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export function SecretForm({ title, description, status }: SecretFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await setSitePassword(previous, formData);
    // Clear the fields once saved, so the new value is not left on screen.
    if (result.ok) {
      setPassword("");
      setConfirm("");
    }
    return result;
  }, {});

  const filled = password !== "" && confirm !== "";

  // Submitted by hand rather than through the form's `action`, which would reset the fields
  // even when saving fails.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!filled || pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent component="form" onSubmit={submit} sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          {description}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
          {status}
        </Typography>

        <Stack spacing={2} sx={{ mt: 2.5 }}>
          <PasswordField name="password" label="New password" value={password} onChange={setPassword} />
          <PasswordField name="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} />

          {state.error && <Alert severity="error">{state.error}</Alert>}
          {state.ok && <Alert severity="success">{state.ok}</Alert>}

          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={!filled || pending}
            sx={{ alignSelf: "flex-start" }}
          >
            {pending ? "Saving…" : "Change password"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
