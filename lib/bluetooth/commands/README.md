# MS Connect Bluetooth protocol

This document describes how MS Connect devices exchange data with the MS Connect app over Bluetooth Low Energy (BLE). All six device types use the same transport and message format. They differ only in the message types they send and the commands they accept.

> **Status: draft.** The transport, framing and message envelope are settled. The data model of each device (its message types and their `data` fields) is a **placeholder** that has not been agreed with firmware yet; see section 5.

## 1. Transport

Every device exposes the **Nordic UART Service (NUS)**:

| Role | UUID | Properties |
| --- | --- | --- |
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | |
| **TX**: device → app | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | Notify |
| **RX**: app → device | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | Write (with response); Write Without Response optional |

- The device sends messages as **notifications on TX**. The app enables notifications by writing the TX CCCD. Only send notifications while they are enabled.
- The app writes commands to **RX**. When RX supports Write (with response), the app uses it. The app waits for each write to be acknowledged before it sends the next one.
- Please also expose the standard **Device Information** service (`0x180A`: manufacturer, model number, firmware revision strings) and the **Battery** service (`0x180F`) if the hardware has a battery. The app reads them after connecting and shows them to the user. They are optional, but recommended.
- **Advertising:** each device type should advertise a distinct, fixed local-name prefix (for example `MS-FLOW-…` or `MS-BIN-…`) so the app can list only the matching hardware. Please confirm the prefixes with the app team.

## 2. Framing

Messages are **UTF-8 JSON, one message per line, each line terminated by `\n` (0x0A)** (newline-delimited JSON).

- A message may be split across any number of BLE packets, at any byte boundary. The receiver buffers bytes until it sees `\n`. This means the sender does not need to fit a message into one MTU.
- Do not put a raw newline inside a message. Send compact JSON, not pretty-printed JSON.
- `\r\n` line endings and blank lines are tolerated.
- **Maximum line length: 4096 characters.** The app discards anything longer.
- **The app sends commands in chunks of at most 20 bytes**, so it works with any MTU. The device must join the chunks until it sees `\n` and then parse the whole line.
- When the connection drops, both sides throw away any partly received line.
- If a line is not valid JSON or does not match this spec, the receiver ignores it and keeps reading the next line.

## 3. Message envelope

### Device → app

```json
{"deviceId":"FM-000123","timestamp":1759400000000,"type":"reading","data":{"flowRate":12.5}}
```

| Field | Type | Description |
| --- | --- | --- |
| `deviceId` | string, non-empty | The unit's unique hardware ID (for example the serial number). It must stay the same across reboots and firmware updates. |
| `timestamp` | number | When the device produced the data, in **Unix epoch milliseconds** (UTC), taken from the **device's own clock**. |
| `type` | string, non-empty | Which message this is. See section 5. |
| `data` | object | The message's fields. See section 5. Always an object; use `{}` when there are no fields. |

**The device is the source of truth for time.** The app is often offline and does not set or correct the device clock. It stores `timestamp` exactly as received. The device must keep its own clock (RTC) accurate. How it does that, for example setting it during commissioning, is up to the firmware.

### App → device

```json
{"timestamp":1759400000000,"type":"reset","data":{}}
```

The format is the same, but without `deviceId`, because the Bluetooth link already identifies the unit. Here `timestamp` is the phone's clock when the command was sent. It is informational only, and the device should not set its clock from it.

### Validation rules (applied by the app)

- All four envelope fields are required.
- Messages with an unknown `type` are rejected, and every listed field is required and must have the listed type. The app checks its own outgoing commands the same way before sending them.
- **Unknown extra fields are ignored.** New fields can be added to a message without breaking older app versions. Removing or renaming a field is a breaking change.
- The device should handle commands the same way. If a command has an unknown `type` or invalid `data`, do not act on it. How to report the rejection to the app will be part of the data model. Ignore unknown extra fields.

## 4. Field types

| Spec type | JSON | Notes |
| --- | --- | --- |
| `number` | number | Must be finite. No `NaN` or `Infinity`. Integers and decimals are both fine. |
| `string` | string | |
| `boolean` | `true` / `false` | Not `0`/`1`. |
| `number[]`, `boolean[]`, `string[]` | array | Every element must have the given type. |
| `"a" \| "b"` | string | Must be exactly one of the listed values. |

## 5. Device data models

> **Placeholders.** The message types and fields below are proposals, not agreed with firmware yet. The app already validates strictly against them, so firmware that sends anything else will have its messages rejected until the models are agreed and this table is updated.

Field types are from section 4. `{}` means the message has no fields.

### Discharge Water Flow Monitor

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `flowRate`: number (L/min), `totalVolume`: number (L since last reset) |
| App → device | `requestReading` | `{}` |
| App → device | `resetTotal` | `{}` |

### Dewater Water Level Monitor

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `waterLevel`: number (m) |
| Device → app | `alarm` | `level`: `"high" \| "low" \| "normal"` |
| App → device | `requestReading` | `{}` |
| App → device | `setAlarmLevels` | `highLevel`: number (m), `lowLevel`: number (m) |

### Dewater Pump Float Replacement

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `waterLevel`: number (m), `pumpRunning`: boolean |
| App → device | `requestReading` | `{}` |
| App → device | `setPumpLevels` | `startLevel`: number (m), `stopLevel`: number (m) |
| App → device | `setPumpMode` | `mode`: `"auto" \| "on" \| "off"` |

### Conveyor Volumetric Scale

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `volumeRate`: number (m³/h), `totalVolume`: number (m³ since last reset), `beltSpeed`: number (m/s) |
| App → device | `requestReading` | `{}` |
| App → device | `resetTotal` | `{}` |

### Conveyor Volumetric Scale Pro

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `volumeRate`: number (m³/h), `totalVolume`: number (m³ since last reset), `massRate`: number (t/h), `beltSpeed`: number (m/s) |
| App → device | `requestReading` | `{}` |
| App → device | `resetTotal` | `{}` |
| App → device | `setMaterialDensity` | `density`: number (t/m³) |

### Bin Height Measurement

| Direction | `type` | `data` |
| --- | --- | --- |
| Device → app | `reading` | `height`: number (m, sensor to material surface) |
| Device → app | `settings` | `binHeight`: number (m) |
| App → device | `requestReading` | `{}` |
| App → device | `setBinHeight` | `binHeight`: number (m) |

## 6. Example session

This uses the placeholder Bin Height Measurement model from section 5.

```text
app    connects, enables notifications on TX
device → {"deviceId":"BH-0007","timestamp":1759400001000,"type":"reading","data":{"height":2.4}}\n
app    → {"timestamp":1759400005000,"type":"setBinHeight","data":{"binHeight":6}}\n     (sent as 20-byte chunks)
device → {"deviceId":"BH-0007","timestamp":1759400005020,"type":"settings","data":{"binHeight":6}}\n
```

## For app developers

This document mirrors [schema.ts](schema.ts) and the per-device command files in this folder. Those files are what the app actually validates against. When you change a command file, update this document in the same change.
