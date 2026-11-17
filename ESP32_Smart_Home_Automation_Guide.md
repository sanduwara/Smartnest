# ESP32 Smart Home Automation Project

## 1. System Architecture Explanation

The ESP32 is the central controller. It connects to your Wi-Fi network and starts a local JSON API server. The dashboard is now an external website made from separate HTML, CSS, and JavaScript files.

The browser communicates with the ESP32 using asynchronous `fetch()` requests. The page never needs a full refresh. Sensor and device states are returned from `/api/status` as JSON every 2 seconds, while buttons send JSON `POST` commands to endpoints such as `/api/light`, `/api/door`, `/api/garage`, `/api/bedroom1-mode`, and `/api/bedroom1-ac`.

The firmware loop stays responsive by using `millis()` timing for DHT11 reads, gas reads, RFID scans, Wi-Fi reconnect attempts, IR sensor direction counting, and automatic door re-locking.

Complete upload-ready firmware: [ESP32_Smart_Home_Automation.ino](./ESP32_Smart_Home_Automation.ino)

## 2. Complete Components List

- ESP32 development board
- 6 LEDs with one current-limiting resistor for each light/indicator output:
  - Bedroom 1 Light
  - Bedroom 1 AC Unit indicator
  - Bedroom 2 Light
  - Living Room Light 1
  - Living Room Light 2
  - Kitchen Light
- DHT11 temperature and humidity sensor
- MQ-series analog gas sensor module, such as MQ-2 or MQ-5
- 2 IR obstacle sensors for Bedroom 1 entrance direction counting
- Servo motor for door lock demonstration
- Second servo motor for garage door open/close demonstration
- Physical push button for garage door control
- MFRC522 RFID/NFC reader module
- 16x2 LCD with I2C backpack
- External 5V power supply for the servo
- Jumper wires and breadboard or screw terminal board
- Common GND wiring between ESP32, sensors, and servo supply

## 3. ESP32 GPIO / Pin Connection Table

| Function | ESP32 GPIO | Notes |
|---|---:|---|
| Bedroom 1 LED | GPIO16 | GPIO -> resistor -> LED long leg; LED short leg -> GND |
| Bedroom 1 AC indicator LED | GPIO2 | Boot-strapping pin / onboard LED on many dev boards; GPIO -> resistor -> LED long leg; LED short leg -> GND |
| Bedroom 2 LED | GPIO17 | GPIO -> resistor -> LED long leg; LED short leg -> GND |
| Living Room Light 1 LED | GPIO14 | GPIO -> resistor -> LED long leg; LED short leg -> GND |
| Living Room Light 2 LED | GPIO4 | Boot-strapping pin; see notes |
| Kitchen LED | GPIO15 | Boot-strapping pin; see notes |
| IR_OUTSIDE sensor | GPIO32 | Input with internal pullup |
| IR_INSIDE sensor | GPIO33 | Input with internal pullup |
| DHT11 data | GPIO13 | Data pin |
| Gas sensor analog output | GPIO34 | ADC input only |
| Servo signal | GPIO25 | PWM signal |
| Garage servo signal | GPIO5 | Boot-strapping pin; do not pull during boot |
| Garage push button | GPIO35 | Input only; needs external 10k pull-up |
| LCD SDA | GPIO21 | I2C SDA |
| LCD SCL | GPIO22 | I2C SCL |
| MFRC522 SCK | GPIO18 | SPI clock |
| MFRC522 MISO | GPIO19 | SPI MISO |
| MFRC522 MOSI | GPIO23 | SPI MOSI |
| MFRC522 SDA / SS | GPIO27 | SPI chip select |
| MFRC522 RST | GPIO26 | Reset |

## 4. Important Electrical Notes

- ESP32 GPIO pins are 3.3V logic. Do not feed 5V signals directly into ESP32 pins.
- For direct LEDs, every LED must have a current-limiting resistor. Use about `220 ohm` to `1k ohm`.
- Direct LED wiring for this code is: `GPIO -> resistor -> LED long leg`, then `LED short leg -> GND`.
- The code is now set for direct LED control with `const bool RELAY_ACTIVE_LOW = false;`, so ON writes HIGH to the GPIO.
- Do not connect high-power room lights directly to ESP32 GPIO pins. Use a relay, MOSFET, or proper driver for real lamps.
- The door servo and garage servo should be powered from a suitable external 5V supply, not directly from the ESP32 5V pin when the servos draw meaningful current.
- Always connect the external servo supply GND to ESP32 GND.
- GPIO35 has no internal pull-up resistor. Wire the garage button with an external `10k` pull-up to `3.3V`, and connect the button between GPIO35 and GND.
- MQ gas modules often output analog voltages up to their supply voltage. If powered from 5V, confirm the analog output cannot exceed 3.3V before connecting to GPIO34. Use a voltage divider if needed.
- The MFRC522 module should normally be powered from 3.3V.
- GPIO6 to GPIO11 must not be used because they are connected to the ESP32 flash.
- GPIO2, GPIO4, and GPIO15 are boot-strapping pins. They are used here because this project has many peripherals. If LEDs on those pins affect boot, disconnect them during upload/boot, use higher-value resistors, move them to safer pins, or use an I/O expander such as MCP23017.
- Avoid GPIO1 and GPIO3 unless you understand the Serial Monitor/upload tradeoff.

## 5. Arduino Libraries Required

Install these through the Arduino IDE Library Manager where needed:

- `WiFi.h` included with ESP32 board package
- `WebServer.h` included with ESP32 board package
- `DHT sensor library` by Adafruit
- `Adafruit Unified Sensor`, dependency for many DHT installs
- `LiquidCrystal_I2C`
- `ESP32Servo`
- `SPI.h` included with ESP32 board package
- `MFRC522` by GithubCommunity or Miguel Balboa

This project intentionally uses the built-in synchronous `WebServer.h` instead of `ESPAsyncWebServer` to keep installation simpler for student projects.

## 6. How The Two IR Sensors Determine Entering / Leaving

Place `IR_OUTSIDE` on the outside side of the Bedroom 1 doorway and `IR_INSIDE` on the inside side.

- Entering:
  - `IR_OUTSIDE` triggers first.
  - `IR_INSIDE` triggers afterward within the allowed timing window.
  - `peopleCount` increases by 1.

- Leaving:
  - `IR_INSIDE` triggers first.
  - `IR_OUTSIDE` triggers afterward within the allowed timing window.
  - `peopleCount` decreases by 1.
  - The firmware clamps the value so it never goes below 0.

The firmware uses a small state machine with these states:

- `IR_IDLE`
- `IR_OUTSIDE_FIRST`
- `IR_INSIDE_FIRST`

It also uses debounce and sequence timeout values so one person does not create multiple counts.

## 7. Web API Design

| Endpoint | Example | Purpose |
|---|---|---|
| `/` | `http://192.168.1.100/` | Returns API server info as JSON |
| `/api/status` | `/api/status` | Returns all live sensor and device states |
| `/api/light` | JSON `{ "name": "kitchen", "state": true }` | Controls a single light |
| `/api/living-all` | JSON `{ "state": true }` | Controls both living room lights together |
| `/api/door` | JSON `{ "state": "unlock" }` | Locks or unlocks the servo door |
| `/api/garage` | JSON `{ "state": "open" }` | Opens, closes, or toggles the garage servo |
| `/api/bedroom1-mode` | JSON `{ "mode": "AUTO" }` | Changes Bedroom 1 light between AUTO and MANUAL |
| `/api/bedroom1-ac` | JSON `{ "state": true }` or `{ "mode": "AUTO" }` | Controls Bedroom 1 AC LED manually or returns it to automation |

The external website sends JSON with `POST`, for example:

```js
fetch("http://192.168.1.100/api/light", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "name": "kitchen", "state": true })
});
```

The old query-style URLs still work for quick testing, for example `/api/light?name=kitchen&state=1`.

Example `/api/status` response:

```json
{
  "temperature": 28.5,
  "humidity": 72.0,
  "gas": 950,
  "gasWarning": false,
  "peopleCount": 2,
  "bedroom1": true,
  "bedroom1Mode": "AUTO",
  "bedroom1Ac": true,
  "bedroom1AcMode": "AUTO",
  "bedroom1AcTempThreshold": 30.0,
  "bedroom1AutoReturnPending": false,
  "bedroom2": false,
  "living1": true,
  "living2": false,
  "kitchen": true,
  "doorLocked": true,
  "garageOpen": false,
  "lastNfcStatus": "NFC ACCESS GRANTED"
}
```

## 8. Complete `.ino` Code

The complete firmware is saved here:

[ESP32_Smart_Home_Automation.ino](./ESP32_Smart_Home_Automation.ino)

Edit these required lines before uploading:

```cpp
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
```

Also review these configuration constants:

```cpp
const int GAS_THRESHOLD = 1800;
const int LOCK_POSITION = 10;
const int UNLOCK_POSITION = 100;
const int DOOR_SERVO_STEP_DEGREES = 1;
const unsigned long DOOR_SERVO_STEP_DELAY_MS = 18;
const bool AUTO_RELOCK_ENABLED = true;
const int GARAGE_CLOSED_POSITION = 10;
const int GARAGE_OPEN_POSITION = 100;
const int GARAGE_SERVO_STEP_DEGREES = 1;
const unsigned long GARAGE_SERVO_STEP_DELAY_MS = 18;
const bool BEDROOM1_AUTO_RETURN_AFTER_MANUAL_OFF = true;
const float BEDROOM1_AC_TEMP_THRESHOLD_C = 30.0;
```

For slower door lock movement, increase `DOOR_SERVO_STEP_DELAY_MS`, for example `25` or `30`. For slower garage movement, increase `GARAGE_SERVO_STEP_DELAY_MS`. For faster movement, reduce the delay values.

The door servo now turns a full 90 degrees because `UNLOCK_POSITION - LOCK_POSITION = 100 - 10 = 90`.

## 9. Complete External HTML / CSS / JavaScript Dashboard

The dashboard has been removed from the `.ino` file. Use these external website files instead:

- [ESP32_Dashboard_External.html](./ESP32_Dashboard_External.html)
- [esp32-dashboard.css](./esp32-dashboard.css)
- [esp32-dashboard.js](./esp32-dashboard.js)
- [esp32-api-commands.json](./esp32-api-commands.json)

It includes:

- Light theme dashboard design
- User-selectable Light and Dark themes
- Theme preference saved in browser storage
- Live animated connection indicator
- Cursor-follow background glow
- Button click glow effect
- Animated light glow states
- Live environment cards
- Gas warning animation
- ESP32 IP address input and Connect button
- Bedroom 1 occupancy and AUTO/MANUAL light mode
- Bedroom 1 AC LED control and temperature/occupancy automation
- Individual light controls using JSON commands
- All living room lights control
- Door lock/unlock controls
- Garage door open/close/toggle controls
- Bedroom 1 automatic return to AUTO after manual OFF when the room becomes empty
- Last NFC/RFID status
- Responsive layout for phone and desktop browsers

No Wi-Fi password or sensitive credential is stored in JavaScript.

## 10. No Embedded HTML In The `.ino`

The `.ino` now contains only the ESP32 firmware and JSON API server. It no longer contains:

```cpp
const char index_html[] PROGMEM = R"rawliteral(
...
)rawliteral";
```

Open the external dashboard file on your phone or computer, enter the ESP32 IP address, and press `Connect`.

## 11. Arduino IDE Upload Instructions

1. Install the ESP32 board package in Arduino IDE:
   - File > Preferences
   - Add this Boards Manager URL if needed:
     `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
   - Tools > Board > Boards Manager
   - Search `esp32` and install the Espressif package.
2. Install the required libraries from Library Manager.
3. Open [ESP32_Smart_Home_Automation.ino](./ESP32_Smart_Home_Automation.ino).
4. Edit your Wi-Fi SSID and password.
5. Select your ESP32 board from Tools > Board.
6. Select the correct COM port.
7. Upload the sketch.
8. Open Serial Monitor at `115200` baud.

## 12. How To Find And Open The ESP32 IP Address

At startup, the LCD shows:

```text
Connecting...
```

After Wi-Fi connects, the LCD shows:

```text
WiFi Connected
192.168.x.xxx
```

The Serial Monitor also prints:

```text
WiFi Connected. IP address: 192.168.x.xxx
```

Open a browser on a phone or computer connected to the same Wi-Fi network and enter:

```text
http://192.168.x.xxx
```

Replace `192.168.x.xxx` with the actual ESP32 IP address.

The LCD keeps the IP address visible for 1 minute. After that it changes to a live sensor page:

```text
Temp: 28.5 C
Gas: SAFE
```

If the gas value is above `GAS_THRESHOLD`, the LCD second row shows:

```text
Gas: WARNING
```

Open [ESP32_Dashboard_External.html](./ESP32_Dashboard_External.html), type the ESP32 IP address into the `ESP32 IP` field, for example `192.168.1.100`, then press `Connect`.

## 13. How To Add An Authorized NFC / RFID UID

1. Upload the firmware.
2. Open Serial Monitor at `115200` baud.
3. Scan an RFID card or tag.
4. If the card is not authorized, Serial Monitor prints its UID.
5. Copy that UID into the `authorizedUIDs[]` list.

Example:

```cpp
const char* authorizedUIDs[] = {
  "DE AD BE EF",
  "12 34 56 78",
  "A1 B2 C3 D4"
};
```

Re-upload the sketch after adding the UID.

## 14. How To Calibrate The Gas Threshold

The default value is:

```cpp
const int GAS_THRESHOLD = 1800;
```

Calibration method:

1. Power the MQ sensor and allow warm-up time. Many MQ sensors need several minutes or longer for stable readings.
2. Open the dashboard and observe the normal clean-air gas value.
3. Open Serial Monitor or read `/api/status` to compare values.
4. Set `GAS_THRESHOLD` above normal clean-air readings but below the readings seen during a safe test condition.
5. Re-upload after changing the threshold.

Never use dangerous gas exposure for testing. Follow the gas sensor module datasheet and safety instructions.

## 15. Testing Procedure For Every Subsystem

Test Wi-Fi and dashboard:

- Upload the sketch.
- Confirm LCD shows `WiFi Connected` and the IP address.
- Open [ESP32_Dashboard_External.html](./ESP32_Dashboard_External.html) on a device connected to the same Wi-Fi network.
- Type the ESP32 IP address and press `Connect`.
- Confirm the ESP32 connection status changes to connected.

Test lights:

- After reset, watch the LEDs during startup. The firmware now runs a short LED self-test, turning each light output ON briefly.
- You can also open `/api/light-test` in the browser to repeat the LED self-test.
- Set Bedroom 1 mode to `MANUAL`.
- Press ON/OFF for each light.
- Verify each LED changes state.
- Test `ALL LIVING ROOM LIGHTS`.

Test Bedroom 1 AC automation:

- Confirm the AC indicator LED is connected to GPIO2 with a current-limiting resistor.
- Press ON/OFF in the Bedroom 1 AC Unit panel and verify the LED follows the web command even when occupancy is 0.
- Press AUTO in the Bedroom 1 AC Unit panel.
- Raise the sensed temperature above `BEDROOM1_AC_TEMP_THRESHOLD_C` and set occupancy above 0 by triggering an entry sequence.
- Confirm the AC indicator LED turns ON automatically.
- Trigger exits until occupancy reaches 0 and confirm the AC indicator LED turns OFF in AUTO mode.
- Confirm the AC indicator LED does not turn ON automatically while Bedroom 1 is empty, even if temperature is above the threshold.

Test Bedroom 1 occupancy:

- Set Bedroom 1 mode to `AUTO`.
- Trigger `IR_OUTSIDE`, then `IR_INSIDE`.
- Confirm occupancy increases and Bedroom 1 light turns ON.
- Trigger `IR_INSIDE`, then `IR_OUTSIDE`.
- Confirm occupancy decreases.
- Confirm occupancy never drops below 0.
- Confirm Bedroom 1 light turns OFF when occupancy reaches 0.
- Turn Bedroom 1 OFF from the dashboard while someone is counted inside.
- Confirm the dashboard says AUTO will resume when Bedroom 1 becomes empty.
- Trigger an exit until occupancy reaches 0 and confirm Bedroom 1 returns to AUTO automatically.

Test DHT11:

- Confirm temperature and humidity appear on the dashboard.
- Disconnect the DHT11 data wire briefly and confirm the dashboard shows `Sensor Error`.

Test gas sensor:

- Observe the live gas reading.
- Temporarily lower `GAS_THRESHOLD` for a controlled test.
- Confirm the dashboard shows `GAS LEAK WARNING` and the gas card enters alarm styling.
- Restore a calibrated threshold afterward.

Test servo door:

- Press UNLOCK and verify the servo moves to `UNLOCK_POSITION`.
- Press LOCK and verify the servo moves to `LOCK_POSITION`.
- Confirm the movement is smooth and slower than before. Tune `DOOR_SERVO_STEP_DELAY_MS` if needed.
- If auto re-lock is enabled, confirm the door locks again after `AUTO_RELOCK_DELAY_MS`.

Test garage door:

- Confirm the garage servo is powered from an external 5V supply with common GND.
- Press OPEN on the dashboard and verify the garage servo moves to `GARAGE_OPEN_POSITION`.
- Press CLOSE and verify it moves to `GARAGE_CLOSED_POSITION`.
- Confirm the movement is smooth and slower than before. Tune `GARAGE_SERVO_STEP_DELAY_MS` if needed.
- Open `/api/garage?state=toggle` in the browser and verify the garage toggles.
- Press the physical garage button and verify it toggles once per press.

Test RFID/NFC:

- Scan an authorized UID.
- Confirm Serial Monitor prints access granted.
- Confirm the door unlocks.
- Scan an unauthorized UID.
- Confirm access denied and the UID prints in Serial Monitor.

## 16. Troubleshooting

Wi-Fi does not connect:

- Check `ssid` and `password`.
- Confirm the network is 2.4 GHz. Most ESP32 boards do not support 5 GHz Wi-Fi.
- Move the ESP32 closer to the router.

LCD is blank:

- Check SDA/SCL wiring.
- Confirm the I2C address. Common addresses are `0x27` and `0x3F`.
- Confirm the LCD backpack contrast potentiometer is adjusted.

LED or relay works backward:

- Change:

```cpp
const bool RELAY_ACTIVE_LOW = false;
```

to:

```cpp
const bool RELAY_ACTIVE_LOW = true;
```

ESP32 fails to boot:

- Disconnect devices from GPIO4 or GPIO15 and try again.
- Move those two LED outputs to an I/O expander or different available GPIOs.

Gas reading is always high:

- Allow sensor warm-up time.
- Check analog output voltage does not exceed 3.3V.
- Calibrate `GAS_THRESHOLD`.

DHT11 shows sensor error:

- Check the data pin and pullup resistor.
- Confirm the library is installed.
- Confirm `DHT_TYPE` is set to `DHT11`.

RFID reader does not scan:

- Power MFRC522 from 3.3V.
- Check SPI wiring: SCK 18, MISO 19, MOSI 23, SS 27, RST 26.
- Keep wires short.
- Try another card/tag.

Servo jitters or resets ESP32:

- Use an external 5V supply for the servo motors.
- Connect common GND.
- Add a capacitor across the servo supply if needed.

Garage button does not work:

- GPIO35 requires an external pull-up resistor; `INPUT_PULLUP` does not work on GPIO35.
- Wire `3.3V -> 10k resistor -> GPIO35`, and connect the button between GPIO35 and GND.
- Open Serial Monitor and press the button. The sketch prints whether the garage opened or closed.

Garage opens/closes by itself:

- This is very likely if GPIO35 is connected to a button without the external `10k` pull-up resistor.
- Without the resistor, GPIO35 floats and can randomly read LOW, which looks like a button press.
- Add the `10k` pull-up wiring, or temporarily disconnect the button wire from GPIO35 to confirm the random toggling stops.

Dashboard loads but buttons fail:

- Confirm the browser URL uses the ESP32 IP address, not a copied local file path.
- Confirm the phone/computer is on the same Wi-Fi network.
- Type only the ESP32 address such as `192.168.1.100` or `http://192.168.1.100`, then press `Connect`.
- Open Serial Monitor and press a light button. If you see `Web light command`, the ESP32 received the command and the issue is probably LED polarity, resistor/wiring, pin choice, or active-low/active-high configuration.
- Bedroom 1 light is automatic by default. Pressing its ON/OFF button switches Bedroom 1 light to MANUAL mode before controlling the LED.
- Bedroom 1 AC is automatic by default. In AUTO, it turns ON only when temperature is above `30.0 C` and occupancy is greater than 0. The Bedroom 1 AC ON/OFF buttons switch it to MANUAL mode, so web control can turn it ON even when the room is empty.
- Open Serial Monitor to check for ESP32 resets or Wi-Fi disconnects.
