# MS Connect Bluetooth protocol

How every MS Connect device talks to the MS Connect app over Bluetooth Low Energy (BLE). All device types use the same connection, the same message format and the same command format. The only thing that differs between devices is **which fields they report and which commands they accept** (section 6).

> **Status: draft.** Sections 1–5 are settled. In section 6, only Dewater Pump Float Replacement and Bin Height Measurement have been agreed with firmware; the other device models are placeholders.

## At a glance

```text
            ┌──────────── device → app (TX, notify) ─────────────┐
            │  {"deviceId":"BH-0007","timestamp":1759400000000,  │
            │   "data":{"height":2.41}}\n                        │
 DEVICE  ───┤                                                    ├───  APP
            │  {"cmd":"get_reading"}\n                           │
            │  {"set_bin_height":"6"}\n                          │
            └──────────── app → device (RX, write) ──────────────┘
```

- Everything is **JSON text, one message per line, ending in `\n`**.
- **Device → app:** always the same three-key envelope: `deviceId`, `timestamp`, `data`.
- **App → device:** a one-key JSON object. Either an **action** (`{"cmd":"<name>"}`) or a **setting** (`{"<name>":"<value>"}`).
- The device **replies to every command** with a normal device → app message.

## 1. Connection

Use the **Nordic UART Service (NUS)** if the firmware has its own BLE stack:

| Role | UUID | Properties |
| --- | --- | --- |
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | |
| **TX**: device → app | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | Notify |
| **RX**: app → device | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | Write (with response); Write Without Response optional |

Hardware with an off-the-shelf serial BLE module (JDY-23, HM-10 and similar) may use the module's transparent UART instead: service `0000ffe0-0000-1000-8000-00805f9b34fb`, one characteristic `0000ffe1-0000-1000-8000-00805f9b34fb` (Notify + Write) carrying both directions. Tell the app team which one your device uses.

- The app turns on notifications on TX after connecting. Only send while they are on.
- The app writes to RX using Write with response when available, and waits for each write to be acknowledged before sending the next.
- **Advertise a fixed name prefix per device type** (e.g. `MS-FLOW-…`, `MS-BIN-…`) so the app lists only matching hardware. Confirm prefixes with the app team.
- Optional but recommended: the standard **Device Information** service (`0x180A`: manufacturer, model, firmware revision) and **Battery** service (`0x180F`). Serial modules usually can't provide these.

## 2. Framing: one JSON object per line

- Encode as **UTF-8 JSON**, compact (no pretty-printing, no raw newlines inside a message), and end every message with **`\n`**.
- A message may be **split across any number of BLE packets**. The receiver collects bytes until it sees `\n`, so you don't have to fit a message into one MTU.
- `\r\n` and blank lines are tolerated.
- **Maximum line length: 4096 characters.** Longer lines are discarded.
- A line that isn't valid JSON or doesn't follow this spec is ignored; the receiver just moves on to the next line.
- When the connection drops, both sides throw away any partly received line.

## 3. Device → app

### The envelope

Every message from a device has exactly this shape:

```json
{
  "deviceId": "device-serial-number",
  "timestamp": 1759400000000,
  "data": {
    "field_name": "value"
  }
}
```

Sent on the wire as one line:

```text
{"deviceId":"FM-000123","timestamp":1759400000000,"data":{"flow_rate":12.5,"total_volume":1830}}\n
```

| Key | Type | Rule |
| --- | --- | --- |
| `deviceId` | string | **Required, non-empty.** The unit's unique hardware ID (e.g. serial number). Must stay the same across reboots and firmware updates. |
| `timestamp` | number | **Required.** When the data was produced, in **Unix epoch milliseconds, UTC**. Send `0` if the device doesn't know the time yet; the app then uses the arrival time. |
| `data` | object | **Required, always an object** (may be `{}`). Holds the device's fields, see below. |

A message missing any of these keys, or with the wrong type, is **dropped entirely**.

**Time:** Notehub `req.time` is the source of truth. The app is often offline and never sets or corrects the device clock; it stores `timestamp` exactly as received. Keep the device clock synced to Notehub often enough that every message carries an accurate time.

### The `data` object: one generic shape, different fields per device

The envelope is identical for every device. **`data` is what's device-specific.** It is a **flat object of `field_name: value` pairs**, where each device type has its own list of fields, each with one fixed type (section 6).

Think of it as:

```text
data = { <field name>: <value of that field's type>, ... }
```

The app knows each device's field list and checks every message against it. Allowed field types:

| Type in section 6 | JSON value | Example |
| --- | --- | --- |
| `number` | number, finite (no `NaN`/`Infinity`) | `"flow_rate": 12.5` |
| `string` | string | `"serial_number": "SN-0042"` |
| `boolean` | `true` / `false` (**not** `1`/`0`) | `"pump_1_enabled": true` |
| `"a" \| "b" \| …` | string, exactly one of the listed values | `"alarm": "high"` |
| `number[]`, `string[]`, `boolean[]` | array, every element of that type | `"samples": [1.2, 1.3]` |

Rules:

1. **Each field name has one fixed meaning and type.** There is no "message type". A message carries whichever fields you want to report right now: one, several or all.
2. **The app keeps the latest value of each field.** So a periodic update and a reply to a command use the same field names, and you can split a large state across several messages in any order.
3. **Keep `data` flat.** Use `snake_case` names with primitive values or simple arrays; no nested objects.
4. **A known field with the wrong type rejects the whole message.** For example `"flow_rate": "12.5"` (a string) drops the message.
5. **Unknown fields are ignored**, so you can add new fields without breaking older apps. Removing, renaming or changing the type of a field is a breaking change: agree it with the app team first.

### Reserved fields: `error` and `cmd`

Any device can use these in `data` to report a rejected command:

| Field | Type | Meaning |
| --- | --- | --- |
| `error` | string | Short reason the command was rejected. Shown to the user. |
| `cmd` | string | The action or setting name being answered. Include it with `error` whenever you recognised the command name. |

```json
{"deviceId":"FM-000123","timestamp":1759400000000,"data":{"error":"set_pump_cooldown_min out of range (min 30)","cmd":"set_pump_cooldown_min"}}
```

## 4. App → device

### What the app sends

The app only sends a command when the user presses a control; it sends nothing automatically on connect. Each command is **one JSON object with one key, on one line**. There are two kinds:

**Actions**: no argument. The key is always `cmd`, and the value is the action name.

```json
{"cmd":"get_status"}
```

**Settings**: change a value. The key is the setting name, and the value is the new value, **always as a JSON string**.

```json
{"set_pump_cooldown_min":"60"}
```

Setting values are always strings so the firmware can parse every one the same way:

| Setting type | Sent as | Parse with |
| --- | --- | --- |
| `number` | decimal text: `"60"`, `"15.5"`, `"-0.25"` | `toInt()` / `toFloat()` |
| `boolean` | `"1"` or `"0"` | compare to `"1"` |
| `string`, `"a" \| "b"` | the text itself | string compare |

The app checks the value against the setting's type before sending, so you'll only get well-formed values. You still need to check **ranges** (e.g. minimums) yourself.

### How the app delivers it

- The line is sent in **chunks of at most 20 bytes**, so it works with any MTU. For example `{"set_bin_height":"6"}\n` arrives as `{"set_bin_height":"6` (20 bytes) then `"}\n`.
- **Join the chunks until you see `\n`, then parse the whole line.** Never parse a single chunk.
- Each chunk is written with acknowledgement; the next chunk is sent only after the previous one is acknowledged.

### How the device must reply

Reply to **every** command with a normal device → app message (section 3):

| Command | Reply with |
| --- | --- |
| Action that reads (e.g. `get_status`) | The fields it reads. |
| Action that changes something (e.g. `reset_total`) | The fields it changed, with their new values. |
| Setting that was applied | The field holding the new value: `{"set_bin_height":"6"}` → `"data":{"bin_height":6}`. |
| Rejected command (unknown name, bad or out-of-range value) | `error`, plus `cmd` if you recognised the name. Don't act on it. |

### Naming

Use `snake_case` everywhere. For new firmware:

- Actions that read start with `get_` (`get_status`, `get_reading`).
- A setting that changes field `x` is named `set_x`, and the reply contains field `x`.

Existing firmware may keep its current names (see Dewater Pump Float Replacement).

## 5. Example session

Using a hypothetical bin height model (not the agreed one in section 6):

```text
app    connects, turns on notifications on TX
device → {"deviceId":"BH-0007","timestamp":1759400001000,"data":{"height":2.4}}\n        periodic update
app    → {"cmd":"get_reading"}\n                                                      action (sent in 20-byte chunks)
device → {"deviceId":"BH-0007","timestamp":1759400003000,"data":{"height":2.41}}\n       reply
app    → {"set_bin_height":"6"}\n                                                     setting
device → {"deviceId":"BH-0007","timestamp":1759400005000,"data":{"bin_height":6}}\n      reply with new value
app    → {"set_bin_height":"-1"}\n                                                    setting (out of range)
device → {"deviceId":"BH-0007","timestamp":1759400006000,"data":{"error":"bin height must be positive","cmd":"set_bin_height"}}\n
```

## 6. Device data models

Each table is the device's `data` field list (with types) and the commands it accepts.

> **Placeholders**, except Dewater Pump Float Replacement and Bin Height Measurement. The app already validates strictly against them, so until a model is agreed and this document is updated, a declared field sent with another type will get its message rejected.

### Discharge Water Flow Monitor

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `flow_rate` | number (US gal/min) |
| Field | `total_volume` | number (US gal since last reset) |
| Field | `flow_per_volt` | number (US gal/min per volt of the flow sensor's analog output) |
| Action | `get_reading` | replies `flow_rate`, `total_volume`, `flow_per_volt` |
| Action | `reset_total` | replies `total_volume` |
| Setting | `set_flow_per_volt` | number (US gal/min per V), above 0; replies `flow_per_volt` |

### Dewater Water Level Monitor

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `water_level` | number (m) |
| Field | `alarm` | `"high" \| "low" \| "normal"` |
| Field | `high_alarm_level`, `low_alarm_level` | number (m) |
| Action | `get_reading` | replies `water_level`, `alarm` |
| Setting | `set_high_alarm_level`, `set_low_alarm_level` | number (m); replies `high_alarm_level` / `low_alarm_level` |

### Dewater Pump Float Replacement

Agreed with `firmware/dewater-pump-float-replacement`, whose field and command names are the source of truth; the app follows them. Uses a JDY-23 serial module (section 1). Levels are water heights in m: 20 m minus the radar's distance to the surface. `N` is the pump or column number, 1–6.

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `embedded_software_ver`, `category`, `product_uid`, `serial_number` | string |
| Field | `adc_voltage_v1`, `supply_voltage_v2`, `lat`, `lon` | string, placeholders ending in `nc` until measured |
| Field | `sample_period_s`, `period_s`, `ble_data_interval_s` | number (s), how often periodic data is sent; the name depends on the command that reports it |
| Field | `status` | `"ok" \| "error"`, on every reply to a command |
| Field | `msg` | string, why a command was rejected (with `status` `"error"`); starts with the command name when the firmware recognised it |
| Field | `current_water_level` | number (m) |
| Field | `motor_current` | number (filtered A1 reading, 12-bit ADC counts) |
| Field | `pump_min_off_time_min` | number (min a pump rests after stopping) |
| Field | `water_high_thr` | number (m), at or above it every enabled pump runs |
| Field | `water_low_thr` | number (m), at or below it every pump stops with a fault |
| Field | `pump_logic_mode` | `"normal" \| "alteration" \| "winter"` |
| Field | `pump_N_enabled`, `pump_N_fault` | boolean |
| Field | `pump_N_state` | `"on" \| "off"` |
| Field | `pump_N_total_starts`, `pump_N_current_starts` | number (current = since the last reset) |
| Field | `pump_N_total_runtime`, `pump_N_current_runtime` | number (s; current = since the last reset) |
| Field | `column_N_high_thr`, `column_N_low_thr` | number (m), where column N's pump starts / stops |
| Field | `column_N_pump` | number, the pump answering column N |
| Field | `current_high_thr`, `current_low_thr` | number (12-bit ADC counts) |
| Field | `pump_counts_reset`, `pump_runtime_reset` | number (`1` in the reply to a reset) |
| Periodic | every interval | `current_water_level`, `motor_current`; then per pump `pump_N_state`, `pump_N_fault`, `pump_N_total_starts`, `pump_N_current_starts`, `pump_N_total_runtime`, `pump_N_current_runtime` |
| Action | `get_status` | `embedded_software_ver`, `category`, `product_uid`, `serial_number`, `sample_period_s`, `adc_voltage_v1`, `supply_voltage_v2`, `lat`, `lon` |
| Action | `get_config` | `category`, `product_uid`, `serial_number`, `sample_period_s` |
| Action | `get_pump_states` | three messages: `pump_N_enabled`/`fault`/`state`/`total_runtime`/`current_runtime`/`total_starts`/`current_starts`; `column_N_high_thr`/`low_thr`/`pump`; `current_water_level`, `pump_min_off_time_min`, `water_high_thr`, `water_low_thr`, `pump_logic_mode`, `current_high_thr`, `current_low_thr`, `motor_current` |
| Action | `get_sample_period` | `period_s` |
| Setting | `reset_pump_count` | `"1"` (send `true`); replies `pump_counts_reset` and every `pump_N_current_starts` (0) |
| Setting | `reset_pump_runtime` | `"1"` (send `true`); replies `pump_runtime_reset` and every `pump_N_current_runtime` (0) |
| Setting | `pump_logic_mode` | mode; replies `pump_logic_mode` |
| Setting | `set_pump_cooldown_min` | number 30–1440; replies `pump_min_off_time_min` |
| Setting | `ble_data_interval_s` | number (s); replies `ble_data_interval_s` |
| Setting | `set_water_high_thr_m`, `set_water_low_thr_m` | number (m); replies `water_high_thr` / `water_low_thr` |
| Setting | `set_current_sens_high_thr`, `set_current_sens_low_thr` | number 0–4095; replies `current_high_thr` / `current_low_thr` |
| Setting | `pump_N_set_enable` | boolean; replies `pump_N_enabled` |
| Setting | `pump_N_set_high`, `pump_N_set_low` | number (m), high above low; replies `column_N_high_thr` / `column_N_low_thr` |

The firmware reports a rejected command as `"status":"error"` and `msg` rather than `error`/`cmd`; the app reads it through the command set's `readRejection` (see [schema.ts](schema.ts)).

### Conveyor Volumetric Scale

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `volume_rate` | number (m³/h) |
| Field | `total_volume` | number (m³ since last reset) |
| Field | `belt_speed` | number (m/s) |
| Field | `production_goal` | number (m³ to produce this day or shift) |
| Action | `get_reading` | replies `volume_rate`, `total_volume`, `belt_speed`, `production_goal` |
| Action | `reset_total` | replies `total_volume` |

### Conveyor Volumetric Scale Pro

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `volume_rate` | number (m³/h) |
| Field | `total_volume` | number (m³ since last reset) |
| Field | `mass_rate` | number (t/h) |
| Field | `belt_speed` | number (m/s) |
| Field | `material_density` | number (t/m³) |
| Field | `production_goal` | number (m³ to produce this day or shift) |
| Action | `get_reading` | replies `volume_rate`, `total_volume`, `mass_rate`, `belt_speed`, `production_goal` |
| Action | `reset_total` | replies `total_volume` |
| Setting | `set_material_density` | number (t/m³); replies `material_density` |

### Bin Height Measurement

Agreed with `firmware/Bin-Height-Measurement-Firmware`, whose field and command names are the source of truth. Uses an HM-10 serial module (section 1), which the firmware names `MS-BIN-<4 hex>` at boot. The device has no clock: `timestamp` is `0` until `set_time` is sent; the app sends it on every connect. Periodic samples are only sent while a phone is connected.

| Kind | Name | Type / reply |
| --- | --- | --- |
| Field | `material_height` | number (raw 12-bit ADC reading, 0–4095; not yet calibrated to m) |
| Field | `time_synced` | boolean, whether `set_time` has been received |
| Field | `sample_period_ms` | number (ms), how often a sample is sent |
| Periodic | every `sample_period_ms` | `material_height` |
| Action | `read_now` | replies `material_height` |
| Action | `get_config` | replies `time_synced`, `sample_period_ms` |
| Action | `reset_config` | clears the stored device ID (falls back to the MCU unique ID); replies `time_synced`, `sample_period_ms` |
| Setting | `set_time` | number (epoch ms); replies `time_synced` |
| Setting | `set_device_id` | string, 1–127 printable ASCII characters; replies `time_synced`, `sample_period_ms` with the new `deviceId` |
| Setting | `set_sample_period_ms` | number (ms), 1000–3600000, stored on the device; replies `time_synced`, `sample_period_ms` |

## 7. Firmware checklist

- [ ] Advertises the agreed name prefix and exposes NUS (or the serial module's `ffe0`/`ffe1`).
- [ ] Every outgoing message is compact JSON on one line, ending in `\n`, under 4096 characters.
- [ ] Every outgoing message has `deviceId` (non-empty, stable), `timestamp` (epoch ms, or `0`) and `data` (an object).
- [ ] `data` is flat, uses only the field names in section 6, and every value has the declared type (booleans as `true`/`false`).
- [ ] Incoming bytes are buffered until `\n`; partial lines are dropped on disconnect.
- [ ] Actions (`{"cmd":"…"}`) and settings (`{"name":"value"}`, value always a string) are both handled.
- [ ] Every command gets a reply: the affected fields, or `error` (+ `cmd`).
- [ ] Device clock is synced from Notehub `req.time`.

## For app developers

This document mirrors [schema.ts](schema.ts) and the per-device command files in this folder; those files are what the app actually validates against. When you change a command file, update this document in the same change.
