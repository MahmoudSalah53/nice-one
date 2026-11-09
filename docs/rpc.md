# RPC Methods - Agent Developer Guide

This guide is for backend agent developers who need to call RPC methods to control the frontend web page.

---

## 1. navigate

**Method Name:** `navigate`

**Purpose:** Navigate to a different route/URL

**Supported Payloads:**

```python
# Option 1: Using "route" key (relative path)
payload = {"route": "/about"}

# Option 2: Using "route" key (full URL)
payload = {"route": "https://www.yourwebsite.com/about"}

# Option 3: Using "url" key (alias for route)
payload = {"url": "https://www.yourwebsite.com/about"}

# Option 4: Using "url" key (relative path)
payload = {"url": "/checkout"}
```

**Example Calls:**

```python
# Using "route" key
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="navigate",
    payload=json.dumps({"route": "/checkout"})
)

# Using "url" key (alternative)
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="navigate",
    payload=json.dumps({"url": "https://example.com/page"})
)
```

**Response:**

```json
{ "success": true, "route": "/checkout" }
```

---

## 2. click_button

**Method Name:** `click_button`

**Purpose:** Click a button or element on the page

**Supported Payloads:**

```python
payload = {"jsid": "js-1"}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="click_button",
    payload=json.dumps({"jsid": "js-1"})
)
```

**Response:**

```json
{ "success": true, "jsid": "js-1" }
```

---

## 3. fill_input

**Method Name:** `fill_input`

**Purpose:** Fill text into an input field (supports text, email, number, date, and other input types)

**Supported Payloads:**

```python
# Option 1: Using "text" key
payload = {
    "jsid": "js-1",
    "text": "user@example.com"
}

# Option 2: Using "value" key (same as text)
payload = {
    "jsid": "js-1",
    "value": "user@example.com"
}

# For date inputs (type="date"), use ISO 8601 format (YYYY-MM-DD)
payload = {
    "jsid": "js-5",
    "text": "2025-12-25"
}
```

**Example Call:**

```python
# Text input
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="fill_input",
    payload=json.dumps({
        "jsid": "js-1",
        "text": "john_doe"
    })
)

# Date input
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="fill_input",
    payload=json.dumps({
        "jsid": "js-5",
        "text": "2025-12-25"  # Must be YYYY-MM-DD format
    })
)
```

**Response:**

```json
{ "success": true, "jsid": "js-1", "text": "john_doe" }
```

**Notes:**

- Works with all input types: text, email, number, tel, url, password, search, date, datetime-local, time, etc.
- For `type="date"` inputs, the date **must** be in ISO 8601 format: `YYYY-MM-DD` (e.g., "2025-12-25")
- Other date formats (e.g., "25/12/2025", "Dec 25, 2025") will be rejected by the browser
- For `type="number"` inputs, the value should be a string representation of the number (e.g., "42", "3.14")

---

## 4. set_radio

**Method Name:** `set_radio`

**Purpose:** Select a radio button

**Supported Payloads:**

```python
# Option 1: Select the radio directly (by jsid)
payload = {
    "jsid": "js-1"
}

# Option 2: Select by jsid and value (finds matching value in same radio group)
payload = {
    "jsid": "js-1",
    "value": "male"
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="set_radio",
    payload=json.dumps({
        "jsid": "js-1",
        "value": "male"
    })
)
```

**Response:**

```json
{
  "success": true,
  "jsid": "js-1",
  "value": "male"
}
```

---

## 5. set_checkbox

**Method Name:** `set_checkbox`

**Purpose:** Check, uncheck, or toggle a checkbox

**Supported Payloads:**

```python
# Option 1: Set to checked
payload = {
    "jsid": "js-1",
    "checked": True
}

# Option 2: Set to unchecked
payload = {
    "jsid": "js-1",
    "checked": False
}

# Option 3: Toggle (omit checked key)
payload = {
    "jsid": "js-1"
}
```

**Example Call:**

```python
# Check the checkbox
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="set_checkbox",
    payload=json.dumps({
        "jsid": "js-1",
        "checked": True
    })
)
```

**Response:**

```json
{ "success": true, "jsid": "js-1", "checked": true }
```

---

## 6. select_option

**Method Name:** `select_option`

**Purpose:** Select an option from a dropdown/select element

**Supported Payloads:**

```python
# Option 1: Using "value" key (matches option value attribute)
payload = {
    "jsid": "js-1",
    "value": "option-value"
}

# Option 2: Using "text" key (matches option display text)
payload = {
    "jsid": "js-1",
    "text": "Option Display Text"
}
```

**Example Call:**

```python
# Select by value
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="select_option",
    payload=json.dumps({
        "jsid": "js-1",
        "value": "united-states"
    })
)
```

**Response:**

```json
{
  "success": true,
  "jsid": "js-1",
  "valueOrText": "united-states"
}
```

---

## 7. open_mat_select

**Method Name:** `open_mat_select`

**Purpose:** Open an Angular Material `mat-select` dropdown by its `data-js-id`.

**Supported Payloads:**

```python
payload = {
    "jsid": "js-42"
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="open_mat_select",
    payload=json.dumps({
        "jsid": "js-42"
    })
)
```

**Response:**

```json
{ "success": true, "jsid": "js-42" }
```

---

## 8. select_mat_option

**Method Name:** `select_mat_option`

**Purpose:** Select a specific Angular Material `mat-option` by its `data-js-id`. Use this after opening the `mat-select`.

**Supported Payloads:**

```python
payload = {
    "jsid": "js-99"
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="select_mat_option",
    payload=json.dumps({
        "jsid": "js-99"
    })
)
```

**Response:**

```json
{ "success": true, "jsid": "js-99" }
```

---

## 9. select_stations

**Method Name:** `select_stations`

**Purpose:** Select departure and arrival stations for transportation booking

**Supported Payloads:**

```python
# Option 1: Using "departureName" and "arrivalName"
payload = {
    "departureName": "الرياض",
    "arrivalName": "الدمام"
}

# Option 2: Using "departure" and "arrival" (aliases)
payload = {
    "departure": "الرياض",
    "arrival": "الدمام"
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="select_stations",
    payload=json.dumps({
        "departureName": "الرياض",
        "arrivalName": "الدمام"
    })
)
```

**Response:**

```json
{
  "success": true,
  "departureName": "الرياض",
  "arrivalName": "الدمام"
}
```

**Notes:**

- Station names must match exactly as they appear in the UI (Arabic text)
- When called with new stations, the function automatically:
  1. Opens the station selection dropdown
  2. Selects the departure station (which resets any previously selected arrival station)
  3. Waits for the arrival stations list to update
  4. Selects the arrival station
- This ensures proper reset and update of station selections even when stations are already selected

---

## 8. set_trip_type_and_date

**Method Name:** `set_trip_type_and_date`

**Purpose:** Set the trip type (one-way or round trip) and select travel dates using ISO date format

**Supported Payloads:**

```python
# Option 1: One-way trip using "tripType" and "departureDateISO"
payload = {
    "tripType": "مسار واحد",  # One-way
    "departureDateISO": "2026-02-20"  # ISO format: YYYY-MM-DD
}

# Option 2: Round trip with departure and return dates
payload = {
    "tripType": "ذهاب وعودة",  # Round trip
    "departureDateISO": "2026-01-10",  # Departure date
    "returnDateISO": "2026-04-15"  # Return date
}

# Option 3: Using aliases "type", "departureDate", "returnDate"
payload = {
    "type": "مسار واحد",
    "departureDate": "2026-02-20"
}
```

**Trip Types:**

- `"مسار واحد"` - One-way trip (only `departureDateISO` required)
- `"ذهاب وعودة"` - Round trip (both `departureDateISO` and `returnDateISO` required)

**Date Format:**

- All dates must be in ISO 8601 format: `YYYY-MM-DD` (e.g., `"2026-02-20"`)
- Dates are validated to ensure proper format before processing

**Example Calls:**

**One-way trip:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="set_trip_type_and_date",
    payload=json.dumps({
        "tripType": "مسار واحد",
        "departureDateISO": "2026-02-20"
    })
)
```

**Round trip:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="set_trip_type_and_date",
    payload=json.dumps({
        "tripType": "ذهاب وعودة",
        "departureDateISO": "2026-01-10",
        "returnDateISO": "2026-04-15"
    })
)
```

**Response:**

**One-way trip:**

```json
{
  "success": true,
  "tripType": "مسار واحد",
  "departureDateISO": "2026-02-20"
}
```

**Round trip:**

```json
{
  "success": true,
  "tripType": "ذهاب وعودة",
  "departureDateISO": "2026-01-10",
  "returnDateISO": "2026-04-15"
}
```

**Notes:**

- For round trips (`"ذهاب وعودة"`), `returnDateISO` is required
- Dates must be in ISO format (`YYYY-MM-DD`). Invalid formats will return an error
- The function automatically navigates the calendar to the correct month/year if needed
- If a specific date is not available (disabled), the function will attempt to select it but may fail

---

## 9. set_passengers

**Method Name:** `set_passengers`

**Purpose:** Set the number of passengers (adults, children, and infants) for a booking

**Supported Payloads:**

```python
payload = {
    "adults": 2,
    "children": 1,
    "infants": 0
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="set_passengers",
    payload=json.dumps({
        "adults": 2,
        "children": 1,
        "infants": 0
    })
)
```

**Response:**

```json
{
  "success": true,
  "adults": 2,
  "children": 1,
  "infants": 0
}
```

**Notes:**

- All three passenger counts must be provided as numbers (integers)
- All counts must be non-negative (>= 0)
- The function will automatically increment or decrement the counters to reach the target values

---

## 10. changed_interactive_element (Incoming RPC)

**Method Name:** `changed_interactive_element`

**Purpose:** This RPC is automatically sent from the frontend to the backend agent when a user manually interacts with an element that has a `data-js-id` attribute. The agent should register a handler to receive these notifications.

**Direction:** Frontend → Backend (incoming)

**When It's Sent:**

- When a user clicks a button or link with `data-js-id`
- When a user changes the value of an input field with `data-js-id`
- When a user selects an option from a select dropdown with `data-js-id`
- When a user checks/unchecks a checkbox or radio button with `data-js-id`

**Payload Structure:**

The payload varies based on the element type:

**For Input Fields:**

```json
{
  "jsid": "js-3",
  "tag": "input",
  "type": "text",
  "eventType": "change",
  "value": "user input text"
}
```

**For Checkbox/Radio Inputs:**

```json
{
  "jsid": "js-5",
  "tag": "input",
  "type": "checkbox",
  "eventType": "change",
  "value": "on",
  "checked": true
}
```

**For Select Elements:**

```json
{
  "jsid": "js-7",
  "tag": "select",
  "eventType": "change",
  "selectedOption": "Option Display Text"
}
```

**For Button/Link Clicks:**

```json
{
  "jsid": "js-1",
  "tag": "button",
  "eventType": "click"
}
```

**Example Handler Registration:**

```python
@ctx.room.local_participant.register_rpc_method("changed_interactive_element")
async def handle_changed_interactive_element_rpc(data: RpcInvocationData):
    try:
        payload = json.loads(data.payload)
        print(f"Received changed interactive element from frontend: {payload}")

        # Access the data
        jsid = payload.get("jsid")
        tag = payload.get("tag")
        event_type = payload.get("eventType")  # "click" or "change"

        # Handle based on element type
        if tag == "input":
            input_type = payload.get("type")  # e.g., "text", "checkbox", "radio"
            if input_type in ["checkbox", "radio"]:
                checked = payload.get("checked")
                print(f"Checkbox/Radio {jsid} is now: {checked}")
            else:
                value = payload.get("value")
                print(f"Input {jsid} changed to: {value}")
        elif tag == "select":
            selected_text = payload.get("selectedOption")
            print(f"Select {jsid} selected: {selected_text}")
        elif tag in ["button", "a"]:
            print(f"Button/Link {jsid} was clicked")

        return json.dumps({"success": True, "message": "Changed interactive element received"})
    except Exception as e:
        print(f"Error handling changed interactive element: {e}")
        return json.dumps({"success": False, "message": str(e)})
```

**Payload Fields:**

- `jsid` (string, required): The JavaScript ID of the element (e.g., "js-1", "js-2")
- `tag` (string, required): The HTML tag name (e.g., "input", "select", "button", "a")
- `eventType` (string, required): Either "click" or "change"
- `type` (string, optional): Input type for input elements (e.g., "text", "number", "email", "checkbox", "radio")
- `value` (string, optional): The value for input/textarea elements (NOT sent for select elements)
- `checked` (boolean, optional): Only sent for checkbox/radio inputs
- `selectedOption` (string, optional): Only sent for select elements - contains the display text of the selected option (NOT the value)

**Notes:**

1. Only elements with `data-js-id` attributes trigger this RPC
2. The frontend automatically tracks user interactions - no configuration needed
3. Properties are only included when relevant (e.g., `checked` only for checkboxes/radios, `selectedOption` only for selects)
4. For select elements, `selectedOption` contains the visible text, not the option's value attribute
5. This RPC is fire-and-forget from the frontend perspective - errors are logged but don't block execution

---

## 11. added_or_removed_interactive_elements

**Method Name:** `added_or_removed_interactive_elements`

**Direction:** Frontend → Backend

**Purpose:** Notify the backend agent when interactive elements are added to or removed from the DOM. This is automatically triggered by the frontend when the DOM changes (elements are dynamically added or removed).

**When It's Called:**

- Automatically triggered by the frontend when interactive elements are added to the page
- Automatically triggered when interactive elements are removed from the page
- Uses a MutationObserver to detect DOM changes
- Only tracks elements that are interactive (inputs, buttons, selects, links, etc.)

**Payload Structure:**

```json
{
  "added": [
    {
      "jsId": "js-1",
      "tag": "button",
      "type": "button",
      "textContent": "Click Me",
      "lbl": "Submit Button",
      ...
    },
    ...
  ],
  "removed": [
    {
      "jsId": "js-5",
      "tag": "input",
      "type": "text",
      "placeholder": "Enter name",
      ...
    },
    ...
  ]
}
```

**Example Handler Registration:**

```python
@ctx.room.local_participant.register_rpc_method("added_or_removed_interactive_elements")
async def handle_added_or_removed_interactive_elements_rpc(data: RpcInvocationData):
    try:
        payload = json.loads(data.payload)
        print(f"Received added/removed interactive elements from frontend: {payload}")

        # Access the data
        added_elements = payload.get("added", [])
        removed_elements = payload.get("removed", [])

        # Handle added elements
        if added_elements:
            print(f"Added {len(added_elements)} interactive element(s):")
            for element in added_elements:
                jsid = element.get("jsId")
                tag = element.get("tag")
                print(f"  - {tag} with jsid: {jsid}")

        # Handle removed elements
        if removed_elements:
            print(f"Removed {len(removed_elements)} interactive element(s):")
            for element in removed_elements:
                jsid = element.get("jsId")
                tag = element.get("tag")
                print(f"  - {tag} with jsid: {jsid}")

        # Update your internal state or chat context as needed
        # session.history.add_message(role="user", content=f"DOM changed: {len(added_elements)} added, {len(removed_elements)} removed")

        return json.dumps({"success": True, "message": "received updates!"})
    except Exception as e:
        print(f"Error handling added or removed elements: {e}")
        return json.dumps({"success": False, "message": str(e)})
```

**Payload Fields:**

- `added` (array, required): Array of `InteractiveElementNode` objects representing newly added interactive elements. Can be empty array `[]` if no elements were added.
- `removed` (array, required): Array of `InteractiveElementNode` objects representing removed interactive elements. Can be empty array `[]` if no elements were removed.

**InteractiveElementNode Structure:**

Each element in the `added` or `removed` arrays follows the `InteractiveElementNode` interface:

- `jsId` (string, required): The JavaScript ID of the element (e.g., "js-1", "js-2")
- `tag` (string, required): The HTML tag name (e.g., "input", "select", "button", "a", "form")
- `type` (string, required): The element type (e.g., "text", "button", "submit", "checkbox", "radio", "select")
- `value` (string, optional): Current value for input/textarea elements
- `textContent` (string, optional): Text content of the element
- `selectedElement` (string, optional): Currently selected option for select elements
- `options` (array, optional): Array of option values for select elements
- `checked` (boolean, optional): Checked state for checkbox/radio inputs
- `lbl` (string, optional): Associated label text
- `placeholder` (string, optional): Placeholder text for input elements
- `href` (string, optional): URL for anchor (`<a>`) elements
- `target` (string, optional): Target attribute for anchor elements (e.g., "\_blank")
- `children` (array, optional): Nested interactive elements (for forms)

**Response:**

```json
{ "success": true, "message": "received updates!" }
```

**Notes:**

1. This RPC is automatically sent by the frontend - no manual triggering needed
2. The frontend uses a MutationObserver to detect DOM changes
3. Only interactive elements (inputs, buttons, selects, links, forms, etc.) are tracked
4. Both `added` and `removed` arrays are always present, but may be empty
5. This RPC is fire-and-forget from the frontend perspective - errors are logged but don't block execution
6. The `jsId` values in removed elements may reference elements that no longer exist in the DOM
7. Use this to keep your agent's understanding of the page state synchronized with the actual DOM

---

## 12. add_to_cart

**Method Name:** `add_to_cart`

**Purpose:** Add the current product on the page to the shopping cart, optionally setting quantity and warranty.

**Supported Payloads:**

```python
# With warranty (second option, index 1)
payload = {
    "quantity": "2",
    "warranty_index": 1
}

# No warranty
payload = {
    "quantity": "1",
    "warranty_index": -1
}

# First warranty option
payload = {
    "quantity": "1",
    "warranty_index": 0
}

# Aliases: qty for quantity, warranty for warranty_index
payload = {
    "qty": "3",
    "warranty": 0
}
```

**Example Call:**

```python
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="add_to_cart",
    payload=json.dumps({
        "quantity": "2",
        "warranty_index": 1
    })
)
```

**Response:**

```json
{
  "success": true,
  "quantity": "2",
  "warranty_index": 1
}
```

**Validation:**

- **Quantity:** Must be an integer **≥ 1** and **≤ the maximum value** offered in the page’s quantity select (e.g. if the select has options 1–5, only `"1"` through `"5"` are valid). If `quantity` is less than 1 or greater than the last option’s value, the RPC returns `success: false` with an error.
- **warranty_index:** Optional. Use `-1` or omit for no warranty; use `0`, `1`, `2`, … for the first, second, third, … warranty option. If the index is out of range, the implementation falls back to “no warranty”.

**Notes:**

- No `jsid` is used; the frontend uses the page’s quantity select and add-to-cart button.
- `quantity` must be a **string** (e.g. `"1"`, `"2"`).
- `warranty_index` must be a **number** (`-1` for no warranty, or a valid index).

---

## 13. checkout

**Method Name:** `checkout`

**Purpose:** On the checkout page, set the country, then fill either phone (Saudi Arabia) or email (other countries) and proceed by clicking the checkout button.

**Behavior:**

1. Find the country select on the page, set its value to the provided `country`, and dispatch `input` and `change` events.
2. If **country is SA** (Saudi Arabia): fill the input with class `input-tel__input` with `phone_number`.
3. If **country is not SA**: fill the `input[type="email"]` with `email`.
4. Click the same submit button (e.g. `.button--secondary`) in both cases; if it is disabled, the frontend watches until it becomes enabled then clicks it.

**Supported Payloads:**

```python
# Saudi Arabia — phone required (9 digits, must start with 5)
payload = {
    "country": "SA",
    "phone_number": "501234567"
}

# Other country — email required
payload = {
    "country": "AE",
    "email": "user@example.com"
}

# Aliases for country: countryCode, country_code
# Aliases for phone: phoneNumber, phone
# Aliases for email: emailAddress
payload = {
    "country": "SA",
    "phoneNumber": "501234567"
}
```

**Example Calls:**

```python
# Checkout with Saudi phone (9 digits, starting with 5)
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="checkout",
    payload=json.dumps({
        "country": "SA",
        "phone_number": "501234567"
    })
)

# Checkout with email (non-SA)
response = await room.local_participant.perform_rpc(
    destination_identity=client_participant.identity,
    method="checkout",
    payload=json.dumps({
        "country": "AE",
        "email": "customer@example.com"
    })
)
```

**Response (success):**

```json
{
  "success": true,
  "country": "SA",
  "phone_number": "501234567"
}
```

```json
{
  "success": true,
  "country": "AE",
  "email": "customer@example.com"
}
```

**Validation:**

- **country** (required): Non-empty string (e.g. `"SA"`, `"AE"`). Comparison for SA is case-insensitive.
- For **country SA:** **phone_number** is required and must be **exactly 9 digits** and **must start with 5** (e.g. `"501234567"`). No leading zero; invalid formats return an error.
- For **any other country:** **email** is required (non-empty string).

**Notes:**

- This RPC is site-specific (e.g. Jareer). The country select is resolved via `select[name="country"]`, then `#country`, then the first `select` on the page.
- Sending the wrong field (e.g. `email` for SA or `phone_number` for non-SA) will result in a validation error.

---

## General Notes

### Error Responses

All methods return this format on error:

```json
{ "success": false, "error": "Error description" }
```

### Best Practices

1. Always check the `success` field in responses
2. Use `jsid` (JavaScript ID) from the DOM elements JSON sent by the frontend - these are automatically assigned as `data-js-id` attributes
3. The `jsid` format is `js-1`, `js-2`, etc. - use the exact value from the interactive elements JSON
4. Handle errors gracefully
5. Wait for responses before proceeding to next action
6. For `select_option`, prefer using the `value` key when the option's value attribute is known, or use `text` when matching by visible text
7. The frontend automatically sets `data-js-id` attributes on all interactive elements when the popup opens
