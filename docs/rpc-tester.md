# LiveKit RPC Tester

A web-based tool for testing LiveKit RPC (Remote Procedure Call) methods with your LiveKit agents. This tool allows you to connect to an active LiveKit room, select participants, and send RPC requests to test your agent's functionality.

## Overview

The RPC Tester is accessible at `/rpctester` and provides a user-friendly interface to:
- Connect to LiveKit rooms with active agent sessions
- View all participants in the room
- Send RPC requests to specific participants (agents)
- Monitor RPC responses and errors
- View detailed event logs

## Prerequisites

Before using the RPC Tester, you need:
- LiveKit API credentials configured in `.env.local` (API Key, API Secret, and LiveKit URL)
- An active LiveKit room with at least 2 participants (agent + client)
- The agent must have RPC methods registered

## Getting Started

### 1. Configure Credentials

The RPC Tester reads credentials from your `.env.local` file. Ensure you have the following environment variables set:

```env
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_URL=wss://your-project.livekit.cloud
```

**Where to find your credentials:**
- Log in to your [LiveKit Cloud dashboard](https://cloud.livekit.io/)
- Navigate to your project settings
- Copy your API Key, API Secret, and WebSocket URL

**Note:** The `LIVEKIT_URL` should start with `wss://` (WebSocket Secure).

### 2. Access the RPC Tester

Navigate to `http://localhost:3000/rpctester` (or your deployment URL + `/rpctester`).

You can also access it from the main page by clicking the "RPC Tester" link in the header.

### 3. Connect to a Room

1. Click the **"Connect"** button
2. The tester will automatically:
   - Use credentials from your server's environment variables
   - Search for rooms with at least 2 participants (agent + client)
   - Connect to the first available room as a third participant
3. Once connected, you'll see:
   - The room name displayed in green
   - All participants listed in the **Participants** panel
   - Your local identity (marked as "Local")

### 4. Select RPC Destination

In the **Participants** panel:
- Click on any participant to select them as the RPC destination
- The selected participant will be highlighted
- Their identity will automatically populate the "Destination Identity" field

You can also manually type the participant identity in the **Destination Identity** field.

## Sending RPC Requests

### 1. Fill in RPC Details

**Destination Identity:**
- The identity of the participant (agent) you want to send the RPC to
- Can be selected by clicking a participant in the list
- Or manually entered

**Method Name:**
- The name of the RPC method registered on the agent
- Must match exactly (case-sensitive)
- Examples: `navigate`, `click_button`, `fill_input`, `set_radio`, etc.

**Payload:**
- The data to send with the RPC request
- Can be JSON format: `{"key": "value", "number": 123}`
- Or plain text: `Hello, agent!`
- Must be under 15KB (LiveKit's RPC limit)
- The tester will warn you if approaching the limit

### 2. Send the RPC

Click the **"Send RPC"** button to send your request.

### 3. View Response

After sending:
- **Success:** The response will appear in the **RPC Response** panel
- **Error:** Error details and troubleshooting tips will be shown
- **Logs:** All events are logged in the **Event Log** panel

## Understanding the Interface

### Connection Panel
- **Connect/Disconnect Buttons:** Manage your connection
- **Connection Status:** Shows current room name when connected
- Credentials are automatically loaded from server environment variables

### Participants Panel
- **Local Participant:** Your identity (marked as "Local")
- **Remote Participants:** All other participants in the room
- **Click to Select:** Click any participant to set them as RPC destination

### RPC Request Panel
- **Destination Identity:** Who to send the RPC to
- **Method Name:** The RPC method to call
- **Payload:** The data to send (JSON or text)
- **Payload Size Indicator:** Shows payload size in KB
- **Send RPC Button:** Execute the request

### RPC Response Panel
- **Success Response:** Shows formatted JSON or text response
- **Error Response:** Shows detailed error information and troubleshooting tips

### Event Log
- **Real-time Logging:** All connection and RPC events
- **Color-coded:** Different colors for different event types
  - Green: Success
  - Red: Errors
  - Yellow: Warnings
  - Blue: RPC Requests
  - Purple: RPC Responses
- **Timestamps:** Precise timestamps for each event
- **Clear Button:** Clear all logs

## Common Use Cases

### Testing Navigation RPC

```json
Method: navigate
Payload: {"url": "https://example.com/page"}
```

### Testing Button Click RPC

```json
Method: click_button
Payload: {"jsid": "js-123"}
```

### Testing Form Fill RPC

```json
Method: fill_input
Payload: {"jsid": "js-456", "value": "John Doe"}
```

### Testing Radio Button Selection

```json
Method: set_radio
Payload: {"jsid": "js-789"}
```

### Testing Checkbox Toggle

```json
Method: set_checkbox
Payload: {"jsid": "js-101", "checked": true}
```

### Testing Dropdown Selection

```json
Method: select_option
Payload: {"jsid": "js-202", "value": "option2"}
```

## Troubleshooting

### Connection Issues

**"Missing LiveKit credentials in .env.local"**
- Ensure your `.env.local` file contains `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_URL`
- Restart the Next.js dev server after adding/changing environment variables

**"No room found with >= 2 participants"**
- Ensure you have an active agent session running
- The agent and at least one client must be connected
- Check that your credentials are correct

**"Connection failed"**
- Verify your API credentials are correct
- Check that the LiveKit URL is correct (should start with `wss://`)
- Ensure your network allows WebSocket connections

### RPC Issues

**"RPC Handler Not Registered"**
- The method name must match exactly what's registered on the agent
- Check your agent code for the registered method names
- Ensure the agent is fully connected before sending RPCs

**"Destination Not Ready"**
- The participant may not be fully connected yet
- Wait a few seconds and try again
- Check the Participants panel to verify the participant is listed

**"Payload too large"**
- LiveKit RPC has a 15KB limit
- Reduce the payload size
- Consider chunking large data or using a different approach

**"Method name cannot be empty"**
- Ensure you've entered a method name
- Check for leading/trailing spaces

### Other Issues

**No styling/CSS not loading**
- Ensure the page is accessed through the Next.js server
- Check browser console for CSS loading errors
- Try refreshing the page

**Participants not showing**
- Wait a moment for the connection to fully establish
- Check the Event Log for connection events
- Try disconnecting and reconnecting

## Best Practices

1. **Configure credentials** in `.env.local` before starting the server
2. **Check participant list** before sending RPCs
3. **Monitor the Event Log** for connection issues
4. **Use JSON format** for structured data
5. **Keep payloads small** (under 10KB recommended)
6. **Test with simple payloads first** before complex ones
7. **Clear logs regularly** to keep the interface clean

## Technical Details

### How It Works

1. **Credentials Loading:** The server reads LiveKit credentials from environment variables
2. **Room Discovery:** The tester queries LiveKit for rooms with >= 2 participants
3. **Connection:** Joins the room as a third participant using LiveKit's AccessToken
4. **RPC Execution:** Uses `performRpc()` method from LiveKit client SDK
5. **Response Handling:** Processes responses (string, JSON, or binary)

### API Endpoint

The tester uses `/api/rpctester/connect` which:
- Reads LiveKit credentials from `.env.local` (server-side)
- Finds rooms with active sessions
- Generates an access token for the tester
- Returns connection details

### Payload Limits

- **LiveKit RPC Limit:** 15KB
- **Warning Threshold:** 14KB (yellow warning)
- **Error Threshold:** 15KB+ (red error, request blocked)

## Security Notes

- **Credentials are server-side only** - they are read from environment variables on the server
- **Never commit `.env.local`** to version control
- **Use environment variables** for production credentials
- **Disconnect when done** to close the connection

## Support

For issues or questions:
1. Check the Event Log for detailed error messages
2. Review the troubleshooting section above
3. Check your agent logs for server-side errors
4. Verify your LiveKit project settings

## Example Workflow

1. Configure credentials in `.env.local`
2. Start your agent and client application
3. Start the Next.js dev server (`pnpm dev`)
4. Open the RPC Tester at `/rpctester`
5. Click "Connect" - wait for connection confirmation
6. Select the agent participant from the list
7. Enter method name: `navigate`
8. Enter payload: `{"url": "https://example.com"}`
9. Click "Send RPC"
10. View the response in the RPC Response panel
11. Check the Event Log for detailed information

---

**Happy Testing!** 🚀
