# MS Connect

MS Connect is a web app for connecting to MS Connect field devices, monitoring them and configuring them. It is an installable Progressive Web App. It talks to most hardware directly over **Bluetooth Low Energy** from the browser (Web Bluetooth), and to cellular devices such as the Asset Tracker **through the cloud**.

Every device has a **demo mode** that runs a simulated unit, so anyone can try a device's dashboard without having the hardware.

## Devices

The home page lists every device type, with search. Cards start hidden and are revealed with the eye button. Your choice is remembered in the browser and cleared when you sign out. Each device has its own page at `/devices/{slug}`.

| Device | Slug | Link | Data model |
| --- | --- | --- | --- |
| Dewater Pump Float Replacement | `dewater-pump-float-replacement` | Bluetooth (JDY-23 serial module) | Agreed with firmware |
| Bin Height Measurement | `bin-height-measurement` | Bluetooth (`MS-BIN…` / HM-10 serial module) | Agreed with firmware |
| Conveyor Volumetric Scale | `conveyor-volumetric-scale` | Bluetooth (NUS) | Placeholder |
| Conveyor Volumetric Scale Pro | `conveyor-volumetric-scale-pro` | Bluetooth (NUS) | Placeholder |
| Discharge Water Flow Monitor | `discharge-water-flow-monitor` | Bluetooth (NUS) | Placeholder |
| Dewater Water Level Monitor | `dewater-water-level-monitor` | Bluetooth (NUS) | Placeholder |
| Asset Tracker | `asset-tracker` | Cloud, by serial number | Placeholder |

"Placeholder" means the fields and commands are the app's working draft and have not been confirmed with firmware yet. The app still validates messages strictly against them. See [lib/bluetooth/commands/README.md](lib/bluetooth/commands/README.md).

### Dewater Pump Float Replacement

Replaces mechanical floats. It controls up to **6 pumps** from the measured water height and the high and low levels set for each pump relay.

- **Pump Monitoring dashboard**: a water-level gauge, a motor-current column and one column per pump, each with draggable start (high) and stop (low) thresholds.
- Per-pump **enable/disable**, run state (on/off) and fault indicators.
- **Operation mode**: Normal, Winter or Flush.
- **Alteration mode**: No Alteration, Based on Starts or Based on Run Time. This spreads the load across the pumps.
- **Starts and runtime counters**: totals, plus session values since the last reset, with reset dialogs. The phone remembers when each reset happened.
- **Minimum off time**: how long a pump rests after stopping (30–1440 min).
- Global high and low water thresholds, and motor-current thresholds.
- **Water Level Telemetry** chart with the Max and Min threshold lines.
- Levels are shown in feet. The firmware works in metres, and the app converts between them.
- The dashboard is built for where the firmware is heading. Controls the firmware can't handle yet are shown disabled, with the reason. The demo has every feature turned on.

### Bin Height Measurement

Measures how high material sits in a bin, for inventory management. One page can monitor **several bins**, each with its own tab and its own sensor link.

- Add, rename, reorder and remove bins. The list is saved in the browser.
- For each bin, pick a **shape** (Basic storage, Basic trapezoid, Basic bin hopper, Industrial bin hopper), a **material type** (Solid / Liquid) and a **material colour**. There are presets for Coal, Iron ore, Copper ore and Limestone, or you can choose any colour.
- An animated **fill-level visual** and gauge for each bin.
- A **Material height** telemetry chart. A hidden bin's tab keeps recording, so its chart has no gaps.
- **Bluetooth data interval** setting (1 s – 1 h).
- On connect, the app sets the device clock, since the device has none of its own.
- Readings are currently raw 12-bit ADC values (0–4095) and are not yet calibrated to metres.

### Conveyor Volumetric Scale

Reports the volume being produced right now and the total so far.

- An animated **conveyor and stockpile** scene. The belt runs at the reported belt speed, and the pile grows toward the production goal.
- Stats for **volume rate** (m³/h), **total volume** (m³) and **belt speed** (m/s).
- **Reset total volume**.
- Telemetry charts for volume rate and belt speed.

### Conveyor Volumetric Scale Pro

Everything the standard scale does, with camera-assisted volume measurement for higher accuracy.

- Adds **mass rate** (t/h), calculated from the **material density** setting (t/m³).
- Telemetry charts for volume rate and mass rate.

### Discharge Water Flow Monitor

Monitors water flow in discharge systems.

- **Discharge flow gauge**. Its full scale follows the scaling setting.
- **Instantaneous flow rate** (US gal/min) and **total volume**.
- Total volume can be shown in gallons, litres, m³, ft³ or acre-feet. The browser remembers the unit you pick.
- **Reset total**.
- **Scaling** setting: flow per volt of the sensor's analog output.
- Flow rate telemetry chart.

### Dewater Water Level Monitor

Reports the water level and raises alerts when it moves outside high and low levels you set. The sensor hangs under the pump stand and looks down, so it reports the **distance to the water**.

- **Sump gauge** showing the water level against the thresholds.
- **Pump stand to water** distance (ft) and an **Alarm** status (high / low / normal).
- **Max distance** and **Min distance** settings.
- Distance telemetry chart with the threshold lines.

### Asset Tracker

Reports the location, motion and battery of vehicles and equipment. It reports more often while the asset is moving. The tracker uses GPS and cellular to report to the backend, and the app links to it by the **serial number** on the unit.

- **Several assets** on one page, each with its own tab and cloud link. Add, rename, reorder and remove them.
- Dashboard: asset name, **Motion**, **Tracking mode** (active / inactive), **Battery** (% and V), **Charging** and the last reported coordinates.
- **Map** (MapLibre + OpenFreeMap tiles, light and dark):
  - **Live**: a pin follows the tracker. While it's moving, the map also shows where it set off and the path it has taken since.
  - **History**: the route over a chosen period, with quick presets or a custom From/To range. It is split into numbered **stops and trips** in a journey timeline.
- Place names come from OpenStreetMap Nominatim. Each one is looked up only when you ask to see it, and cached.
- Settings: **asset name**, **stationary interval**, **moving interval** and **inactivity timeout**.
- A linked tracker stays linked across visits, and shows its last known data even while offline.

## Features across all devices

- **Connection panel**: connect over Bluetooth, see Device Information (manufacturer, model, firmware, battery) and the connection status. If the link drops, the app reconnects automatically with backoff. One link stays open while you move between pages.
- **Demo mode**: a simulated device that runs the same commands and messages as real firmware. It starts with a backlog of readings, so charts aren't empty. After a demo, a feedback prompt may appear, but rarely.
- **Edit mode**: settings stay locked until you turn on edit mode for that connection. While it's on, leaving the page or disconnecting is blocked, to prevent accidental changes.
- **Telemetry charts**: each session keeps up to 1,000 points per field, and they survive reconnects. Demo readings are never mixed with real ones.
- **Message log**: every line sent and received, including lines the app ignored and why. Useful when bringing up new firmware on a phone.
- **Installable PWA** with offline support. Updates install in the background and are applied only when no device is linked, so an update never cuts off a live session.
- Light and dark themes, plus a contact section that opens a pre-filled email to the sales and support team.

## Bluetooth protocol

All devices share one protocol. Messages are newline-delimited JSON over the Nordic UART Service, or over the transparent UART of a serial module (JDY-23, HM-10).

- **Device → app**: `{"deviceId":"…","timestamp":<epoch ms>,"data":{…}}`
- **App → device**: an action `{"cmd":"get_reading"}` or a setting `{"set_bin_height":"6"}`, sent in 20-byte chunks.

The full spec and each device's data model are in [lib/bluetooth/commands/README.md](lib/bluetooth/commands/README.md).

## Requirements

- Node.js 20+
- A browser with **Web Bluetooth** for real hardware: Chrome or Edge on desktop or Android. Safari and iOS browsers don't support it. Demo mode and cloud devices work in any modern browser.
- Web Bluetooth only works on `https://` or `localhost`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in to `/admin` and set the site password first (see [Access control](#access-control)).

Other scripts: `npm run build`, `npm start`, `npm run lint`.

> This project uses Next.js 16, which has breaking changes from earlier versions. Read the guides in `node_modules/next/dist/docs/` before changing framework-level code.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin sign-in at `/admin` |
| `NEXT_PUBLIC_ASSET_TRACKER_API_URL` | Backend base URL for the Asset Tracker. It must allow this app's origin through CORS. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis on Vercel (set automatically when you connect it) |

## Access control

The whole site sits behind a shared password, set at `/admin`.

- **Admin sign-in** uses `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the environment.
- **The site password** is stored as a hash, together with the key that signs session cookies:
  - **Local / self-hosted `next start`:** in `.data/access-settings.json` (gitignored). No setup needed.
  - **Vercel:** in Upstash Redis. In the Vercel project, open Storage → Marketplace → Upstash Redis and connect it. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Then redeploy.
- Until the admin sets a password, nobody can open the site.

How it works: `proxy.ts` gates every request, including the JS bundles. `app/api/session` signs visitors in. `public/sw.js` enforces the 3-day session offline.

## Project structure

```text
app/                    Routes: home, /devices/[slug], /admin, session APIs, manifest
components/
  device-details/       Shared device page sections: connection, controls, dashboard, telemetry, log
  layout/, providers/   Nav, theme, service worker updater, session watcher
lib/
  bluetooth/            Web Bluetooth link, framing, message validation, demo engine, history
    commands/           Per-device data models + protocol spec (README.md)
  connection/           Connection class and per-device registry (profiles, demos, cloud sources)
  cloud/                Cloud links for devices that report to the backend
  access/               Password gate, sessions, settings store
  homepage/             Device catalog, search, cards
  <device-slug>/        Each device's Bluetooth profile, demo simulator and details page
proxy.ts                Request gate
```

### Adding a device

1. Add it to the catalog in [lib/homepage/devices.ts](lib/homepage/devices.ts).
2. Define its fields, actions and settings in `lib/bluetooth/commands/<slug>.ts` and register it in [index.ts](lib/bluetooth/commands/index.ts).
3. Create `lib/<slug>/` with a `bluetooth-profile.ts`, a `demo.ts` and a `device-details.tsx`.
4. Register the profile and demo in [lib/connection/registry.ts](lib/connection/registry.ts), and the details page in [components/device-details/registry.ts](components/device-details/registry.ts).
5. Document the data model in section 6 of the protocol README.
