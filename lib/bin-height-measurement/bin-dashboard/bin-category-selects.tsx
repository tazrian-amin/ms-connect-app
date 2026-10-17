"use client";

import { useId, type ReactNode } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import AirIcon from "@mui/icons-material/Air";
import GrainIcon from "@mui/icons-material/Grain";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import { BIN_CATEGORIES, MATERIAL_TYPES, type BinCategory, type MaterialType } from "./bin-categories";
import { BinThumbnail } from "./bin-thumbnails";

type Option<T extends string> = { value: T; label: string; description?: string; icon?: ReactNode };

type OptionSelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
};

/** A full-width select listing `options` as menu items, each with an optional icon and description. */
function OptionSelect<T extends string>({ label, value, options, onChange }: OptionSelectProps<T>) {
  const labelId = useId();
  return (
    <FormControl fullWidth margin="dense">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        renderValue={(v) => {
          const option = options.find((o) => o.value === v);
          return (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", "& svg": { fontSize: 20 } }}>
              {option?.icon}
              <span>{option?.label}</span>
            </Stack>
          );
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.icon && <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>{option.icon}</ListItemIcon>}
            <ListItemText primary={option.label} secondary={option.description} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// Large in the list so the shapes can be told apart; the closed field shrinks them like any icon.
const binCategoryOptions = BIN_CATEGORIES.map((category) => ({
  ...category,
  icon: <BinThumbnail category={category.value} sx={{ fontSize: 36 }} />,
}));

export function BinCategorySelect({ value, onChange }: { value: BinCategory; onChange: (value: BinCategory) => void }) {
  return <OptionSelect label="Bin category" value={value} options={binCategoryOptions} onChange={onChange} />;
}

const materialTypeIcons: Record<MaterialType, ReactNode> = {
  solid: <GrainIcon fontSize="small" />,
  liquid: <WaterDropOutlinedIcon fontSize="small" />,
  gas: <AirIcon fontSize="small" />,
};

const materialTypeOptions = MATERIAL_TYPES.map((type) => ({ ...type, icon: materialTypeIcons[type.value] }));

export function MaterialTypeSelect({ value, onChange }: { value: MaterialType; onChange: (value: MaterialType) => void }) {
  return <OptionSelect label="Material type" value={value} options={materialTypeOptions} onChange={onChange} />;
}
