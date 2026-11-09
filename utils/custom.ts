/**
 * Custom automation functions for specific website interactions
 */

/**
 * Select from .. to .. (Station Selection)
 *
 * @param departureName - The departure station name
 * @param arrivalName - The arrival station name
 * @returns true if successful, false otherwise
 */
export function selectStations(
  departureName: string,
  arrivalName: string
): boolean {
  const clickableArea = document.querySelector<HTMLElement>(
    ".booking-item .form-value"
  );
  if (!clickableArea) {
    console.error("Error: Could not find the initial station selection area.");
    return false;
  }

  // Click to open the dropdown
  clickableArea.click();

  setTimeout(() => {
    // First, find and click the DEPARTURE station from the "from" column (#station-from-list)
    // This will reset the arrival station and update the available arrival stations
    const fromStationList =
      document.querySelector<HTMLElement>("#station-from-list");
    if (!fromStationList) {
      console.error(
        "Error: Could not find the departure station list (#station-from-list)."
      );
      return false;
    }

    const departureStationItem = Array.from(
      fromStationList.querySelectorAll<HTMLElement>(".station-item")
    ).find(
      (item) =>
        item.querySelector(".station-name")?.textContent?.trim() ===
        departureName
    );
    if (!departureStationItem) {
      console.error(
        `Error: Could not find the departure station: ${departureName}`
      );
      return false;
    }
    departureStationItem.click();
    console.log(`Selected departure station: ${departureName}`);

    // Wait for the arrival stations list to update after selecting departure
    setTimeout(() => {
      // Now find and click the ARRIVAL station from the "to" column (#station-to-list)
      const toStationList =
        document.querySelector<HTMLElement>("#station-to-list");
      if (!toStationList) {
        console.error(
          "Error: Could not find the arrival station list (#station-to-list)."
        );
        return false;
      }

      const arrivalStationItem = Array.from(
        toStationList.querySelectorAll<HTMLElement>(".station-item")
      ).find(
        (item) =>
          item.querySelector(".station-name")?.textContent?.trim() ===
          arrivalName
      );

      if (!arrivalStationItem) {
        console.error(
          `Error: Could not find the arrival station: ${arrivalName}`
        );
        return false;
      }
      arrivalStationItem.click();
      console.log(`Selected arrival station: ${arrivalName}`);
      console.log("Successfully set the route.");
    }, 600); // Increased wait time to ensure the arrival list updates
  }, 200); // Increased initial wait time to ensure dropdown is fully open

  return true;
}

/**
 * Navigate calendar to a specific month and year
 * @param targetYear - Target year (e.g., 2026)
 * @param targetMonth - Target month (1-12)
 * @param maxAttempts - Maximum navigation attempts to prevent infinite loops
 * @returns Promise that resolves when navigation is complete or fails
 */
function navigateToMonth(
  targetYear: number,
  targetMonth: number,
  calendarType: "depart" | "return" = "depart",
  maxAttempts: number = 24
): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const paddedMonth = targetMonth.toString().padStart(2, "0");

    const checkAndNavigate = () => {
      attempts++;
      if (attempts > maxAttempts) {
        console.error(
          `Error: Could not navigate to ${targetYear}-${paddedMonth} after ${maxAttempts} attempts`
        );
        resolve(false);
        return;
      }

      // Find the specific calendar title based on calendar type
      // sar-demo uses: #depart-calendar-title or #return-calendar-title
      const calendarTitleId = `${calendarType}-calendar-title`;
      const currentDisplay = document.querySelector<HTMLElement>(
        `#${calendarTitleId}`
      );

      if (!currentDisplay) {
        console.error(
          `Error: Calendar title #${calendarTitleId} not found. Attempt ${attempts}/${maxAttempts}`
        );
        // Wait a bit and retry - calendar might not be loaded yet
        setTimeout(checkAndNavigate, 300);
        return;
      }

      const displayText = currentDisplay?.textContent || "";
      console.log(
        `[navigateToMonth] Calendar ${calendarType} display text: "${displayText}"`
      );

      // Extract year and month from display
      // Format can be: "من يناير 2026" or "الى يناير 2026" or "يناير 2026"
      const yearMatch = displayText.match(/\d{4}/);
      const currentYear = yearMatch ? parseInt(yearMatch[0]) : null;

      // Find month name in display (Arabic month names)
      // The title may include "من" or "الى" prefix, so we search for month names
      const monthNames = [
        "يناير",
        "فبراير",
        "مارس",
        "أبريل",
        "مايو",
        "يونيو",
        "يوليو",
        "أغسطس",
        "سبتمبر",
        "أكتوبر",
        "نوفمبر",
        "ديسمبر",
      ];
      let currentMonth: number | null = null;
      for (let i = 0; i < monthNames.length; i++) {
        if (displayText.includes(monthNames[i])) {
          currentMonth = i + 1;
          break;
        }
      }

      // If we can't determine current month/year, try to navigate anyway
      if (currentYear === null || currentMonth === null) {
        console.log(
          `[navigateToMonth] Cannot determine current date. Year: ${currentYear}, Month: ${currentMonth}`
        );
        // Try to find navigation buttons for the specific calendar
        const nextButton = document.querySelector<HTMLElement>(
          `#${calendarType}-next-month`
        );
        if (nextButton) {
          console.log(
            `[navigateToMonth] Clicking next button to navigate forward`
          );
          nextButton.click();
          setTimeout(checkAndNavigate, 300);
          return;
        } else {
          console.error(
            `[navigateToMonth] Next button #${calendarType}-next-month not found`
          );
        }
      } else {
        console.log(
          `[navigateToMonth] Current: ${currentYear}-${currentMonth}, Target: ${targetYear}-${targetMonth}`
        );
        // Calculate how many months to navigate
        const currentDate = new Date(currentYear, currentMonth - 1, 1);
        const targetDate = new Date(targetYear, targetMonth - 1, 1);
        const monthsDiff =
          (targetDate.getFullYear() - currentDate.getFullYear()) * 12 +
          (targetDate.getMonth() - currentDate.getMonth());

        if (monthsDiff === 0) {
          // We're at the target month
          resolve(true);
          return;
        }

        // Find navigation buttons for the specific calendar
        const nextButton = document.querySelector<HTMLElement>(
          `#${calendarType}-next-month`
        );
        const prevButton = document.querySelector<HTMLElement>(
          `#${calendarType}-prev-month`
        );

        if (monthsDiff > 0 && nextButton) {
          nextButton.click();
          setTimeout(checkAndNavigate, 300);
          return;
        } else if (monthsDiff < 0 && prevButton) {
          prevButton.click();
          setTimeout(checkAndNavigate, 300);
          return;
        }
      }

      // If we get here, try one more time after a delay
      setTimeout(checkAndNavigate, 300);
    };

    checkAndNavigate();
  });
}

/**
 * Select a specific date in the calendar
 * @param day - Day of month (1-31)
 * @param calendarType - Which calendar to select from: "depart" or "return"
 * @returns true if date was selected, false otherwise
 */
function selectDate(
  day: number,
  calendarType: "depart" | "return" = "depart"
): boolean {
  const dayStr = String(day);

  // sar-demo uses buttons with class "calendar-day" inside the specific calendar
  // Find the calendar container first
  const calendarContainer = document.querySelector<HTMLElement>(
    `#${calendarType}-calendar`
  );

  if (!calendarContainer) {
    console.error(
      `Error: Calendar container #${calendarType}-calendar not found`
    );
    return false;
  }

  // Find all date buttons within this calendar
  const dateCells = Array.from(
    calendarContainer.querySelectorAll<HTMLElement>("button.calendar-day")
  );

  // Find the button that matches the day and is not disabled
  const dateCell = dateCells.find(
    (cell) =>
      cell.textContent?.trim() === dayStr &&
      !cell.classList.contains("disabled") &&
      !cell.classList.contains("past") &&
      !cell.classList.contains("empty") &&
      !cell.hasAttribute("disabled")
  );

  if (dateCell) {
    dateCell.click();
    console.log(
      `Successfully selected day: ${day} in ${calendarType} calendar`
    );
    return true;
  } else {
    console.error(
      `Error: Day ${day} not found or is disabled in ${calendarType} calendar`
    );
    return false;
  }
}

/**
 * Set Trip Type and Date using ISO date format (YYYY-MM-DD)
 *
 * This function simulates the entire date selection workflow:
 * 1. Opens the 'Travel Dates' input modal.
 * 2. Selects the specified trip type ('مسار واحد' or 'ذهاب وعودة').
 * 3. Navigates to the correct month/year for the departure date.
 * 4. Selects the departure date.
 * 5. For round trips, navigates to the return date month/year and selects it.
 *
 * @param tripType - The desired trip type: 'مسار واحد' (One-way) or 'ذهاب وعودة' (Round Trip).
 * @param departureDateISO - The departure date in ISO format: "YYYY-MM-DD" (e.g., "2026-02-20").
 * @param returnDateISO - Optional return date in ISO format for round trips: "YYYY-MM-DD" (e.g., "2026-04-15").
 * @returns true if the initial operation starts successfully, false otherwise.
 *
 * @example
 * // One-way trip on February 20, 2026:
 * setTripTypeAndDateISO("مسار واحد", "2026-02-20");
 *
 * // Round trip that requires navigation for the Return Date (Jan 2026 to Apr 2026):
 * setTripTypeAndDateISO("ذهاب وعودة", "2026-01-10", "2026-04-15");
 */
export function setTripTypeAndDateISO(
  tripType: string,
  departureDateISO: string,
  returnDateISO?: string
): boolean {
  // Validate and parse departure date
  const departureDate = new Date(departureDateISO + "T00:00:00");
  if (isNaN(departureDate.getTime())) {
    console.error(
      `Error: Invalid departure date format: ${departureDateISO}. Expected format: YYYY-MM-DD`
    );
    return false;
  }

  const departureYear = departureDate.getFullYear();
  const departureMonth = departureDate.getMonth() + 1; // getMonth() returns 0-11
  const departureDay = departureDate.getDate();

  // Validate and parse return date if provided
  let returnYear: number | null = null;
  let returnMonth: number | null = null;
  let returnDay: number | null = null;

  if (returnDateISO) {
    const returnDate = new Date(returnDateISO + "T00:00:00");
    if (isNaN(returnDate.getTime())) {
      console.error(
        `Error: Invalid return date format: ${returnDateISO}. Expected format: YYYY-MM-DD`
      );
      return false;
    }
    returnYear = returnDate.getFullYear();
    returnMonth = returnDate.getMonth() + 1;
    returnDay = returnDate.getDate();
  }

  // Validate trip type for round trip
  if (tripType === "ذهاب وعودة" && !returnDateISO) {
    console.error("Error: Return date is required for round trip (ذهاب وعودة)");
    return false;
  }

  // 1. Locate the 'Travel Dates' input field (the second .booking-item, index 1).
  const bookingItems = document.querySelectorAll<HTMLElement>(".booking-item");
  const travelDateItem = bookingItems[1];
  if (!travelDateItem) {
    console.error(
      "Error: Could not find the 'Travel Dates' booking item (index 1)."
    );
    return false;
  }

  // The element that opens the modal/dropdown.
  const clickableArea =
    travelDateItem.querySelector<HTMLElement>(".form-value");

  if (!clickableArea) {
    console.error(
      "Error: Could not find the clickable area for 'Travel Dates' (.form-value)."
    );
    return false;
  }

  // 2. Click to open the trip type/date selection modal.
  clickableArea.click();
  console.log(
    "Date Action 1: Clicked to open the travel date selection modal."
  );

  // 3. Wait for the dynamic options (One-way/Round Trip buttons) to appear.
  setTimeout(() => {
    // sar-demo uses specific IDs for trip type buttons
    // "مسار واحد" -> trip-type-one-way
    // "ذهاب وعودة" -> trip-type-round-trip
    let targetTripTypeElement: HTMLElement | null = null;

    if (tripType === "مسار واحد") {
      targetTripTypeElement =
        document.querySelector<HTMLElement>("#trip-type-one-way");
    } else if (tripType === "ذهاب وعودة") {
      targetTripTypeElement = document.querySelector<HTMLElement>(
        "#trip-type-round-trip"
      );
    }

    // Fallback: search by text content if ID not found
    if (!targetTripTypeElement) {
      targetTripTypeElement =
        Array.from(
          document.querySelectorAll<HTMLElement>("button.date-option, button")
        ).find(
          (element) =>
            element.textContent?.trim() === tripType &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0
        ) || null;
    }

    if (!targetTripTypeElement) {
      console.error(`Error: Could not find the trip type option: ${tripType}.`);
      console.error(
        "Available trip type buttons:",
        Array.from(
          document.querySelectorAll(
            "button.date-option, #trip-type-one-way, #trip-type-round-trip"
          )
        ).map((btn) => ({ id: btn.id, text: btn.textContent?.trim() }))
      );
      return;
    }

    targetTripTypeElement.click();
    console.log(`Date Action 2: Successfully selected trip type: ${tripType}`);

    // 4. Wait for the calendar to fully update after selecting trip type.
    // For round-trip, we need more time as it shows a different calendar structure
    const waitTime = tripType === "ذهاب وعودة" ? 1000 : 800;

    // Helper function to proceed with date selection
    const proceedWithDateSelection = async () => {
      // Navigate to departure date month/year
      const paddedDepartureMonth = departureMonth.toString().padStart(2, "0");
      console.log(
        `Date Action 3: Navigating to departure date: ${departureYear}-${paddedDepartureMonth}`
      );
      const navSuccess = await navigateToMonth(
        departureYear,
        departureMonth,
        "depart"
      );

      if (!navSuccess) {
        console.error(
          `Error: Failed to navigate to ${departureYear}-${paddedDepartureMonth}`
        );
        return;
      }

      // Wait a bit for calendar to update after navigation
      setTimeout(() => {
        // Select departure date
        const departureSelected = selectDate(departureDay, "depart");
        if (!departureSelected) {
          console.error(
            `Error: Failed to select departure date: ${departureDay}`
          );
          return;
        }

        // If round trip, handle return date
        if (
          tripType === "ذهاب وعودة" &&
          returnYear &&
          returnMonth &&
          returnDay
        ) {
          setTimeout(async () => {
            const paddedReturnMonth = returnMonth!.toString().padStart(2, "0");
            console.log(
              `Date Action 4: Navigating to return date: ${returnYear}-${paddedReturnMonth}`
            );
            const returnNavSuccess = await navigateToMonth(
              returnYear!,
              returnMonth!,
              "return"
            );

            if (!returnNavSuccess) {
              console.error(
                `Error: Failed to navigate to return date: ${returnYear}-${paddedReturnMonth}`
              );
              return;
            }

            // Wait for calendar to update
            setTimeout(() => {
              const returnSelected = selectDate(returnDay!, "return");
              if (!returnSelected) {
                console.error(
                  `Error: Failed to select return date: ${returnDay}`
                );
                return;
              }
              console.log(
                `Successfully set round trip: ${departureDateISO} to ${returnDateISO}`
              );

              // Click the Apply button after selecting both dates
              setTimeout(() => {
                const applyButton =
                  document.querySelector<HTMLElement>("#date-picker-apply");
                if (applyButton && !applyButton.hasAttribute("disabled")) {
                  applyButton.click();
                  console.log("Date Action 5: Clicked Apply button");
                } else {
                  console.error("Error: Apply button not found or is disabled");
                }
              }, 300);
            }, 500);
          }, 500);
        } else {
          console.log(`Successfully set one-way trip: ${departureDateISO}`);

          // Click the Apply button after selecting departure date for one-way trip
          setTimeout(() => {
            const applyButton =
              document.querySelector<HTMLElement>("#date-picker-apply");
            if (applyButton && !applyButton.hasAttribute("disabled")) {
              applyButton.click();
              console.log("Date Action 4: Clicked Apply button");
            } else {
              console.error("Error: Apply button not found or is disabled");
            }
          }, 300);
        }
      }, 500);
    };

    // Wait and then proceed with date selection
    setTimeout(async () => {
      // Verify calendar is visible before proceeding
      const departCalendar =
        document.querySelector<HTMLElement>("#depart-calendar");
      if (!departCalendar || departCalendar.offsetWidth === 0) {
        console.error(
          "Error: Departure calendar not visible yet, waiting longer..."
        );
        // Retry after additional wait
        setTimeout(async () => {
          await proceedWithDateSelection();
        }, waitTime);
        return;
      }

      if (tripType === "ذهاب وعودة") {
        const returnCalendar =
          document.querySelector<HTMLElement>("#return-calendar");
        if (!returnCalendar || returnCalendar.offsetWidth === 0) {
          console.error(
            "Error: Return calendar not visible yet for round trip, waiting longer..."
          );
          setTimeout(async () => {
            await proceedWithDateSelection();
          }, waitTime);
          return;
        }
      }

      await proceedWithDateSelection();
    }, waitTime);
  }, 500);

  return true;
}

/**
 * @deprecated Use setTripTypeAndDateISO instead. This function is kept for backward compatibility.
 * Set Trip Type and Date (legacy version using day number only)
 *
 * @param tripType - The desired trip type: 'مسار واحد' (One-way) or 'ذهاب وعودة' (Round Trip).
 * @param desiredDay - The day number to select in the calendar (e.g., '25').
 * @returns true if the initial operation starts successfully, false otherwise.
 */
export function setTripTypeAndDate(
  tripType: string,
  desiredDay: string
): boolean {
  // 1. Locate the 'Travel Dates' input field (the second .booking-item, index 1).
  const bookingItems = document.querySelectorAll<HTMLElement>(".booking-item");
  const travelDateItem = bookingItems[1];
  if (!travelDateItem) {
    console.error(
      "Error: Could not find the 'Travel Dates' booking item (index 1)."
    );
    return false;
  }
  // The element that opens the modal/dropdown.
  const clickableArea =
    travelDateItem.querySelector<HTMLElement>(".form-value");

  if (!clickableArea) {
    console.error(
      "Error: Could not find the clickable area for 'Travel Dates' (.form-value)."
    );
    return false;
  }
  // 2. Click to open the trip type/date selection modal.
  clickableArea.click();
  console.log(
    "Date Action 1: Clicked to open the travel date selection modal."
  );
  // 3. Wait 500ms for the dynamic options (One-way/Round Trip buttons) to appear.
  setTimeout(() => {
    // Find the element that contains the exact trip type text and is currently visible.
    const targetTripTypeElement = Array.from(
      document.querySelectorAll<HTMLElement>("button, div, span, input")
    ).find(
      (element) =>
        element.textContent?.includes(tripType) && element.offsetWidth > 0
    );

    if (targetTripTypeElement) {
      targetTripTypeElement.click();
      console.log(
        `Date Action 2: Successfully selected trip type: ${tripType}`
      );
      // 4. Wait another 500ms for the calendar to fully update after selecting trip type.
      setTimeout(() => {
        // Use the updated selectDate function that works with sar-demo structure
        const dayNumber = parseInt(desiredDay);
        if (isNaN(dayNumber)) {
          console.error(`Error: Invalid day number: ${desiredDay}`);
          return;
        }

        const dateSelected = selectDate(dayNumber, "depart");
        if (dateSelected) {
          console.log(
            `Date Action 3: Successfully selected day: ${desiredDay}`
          );
        } else {
          console.error(
            `Error: Day ${desiredDay} not found, disabled, or not selectable in the calendar.`
          );

          // FALLBACK: If the requested day is unavailable, try to click the first available day.
          const calendarContainer =
            document.querySelector<HTMLElement>("#depart-calendar");
          if (!calendarContainer) {
            console.error("Error: Calendar container not found for fallback");
            return;
          }
          const dateCells = Array.from(
            calendarContainer.querySelectorAll<HTMLElement>(
              "button.calendar-day"
            )
          );
          const firstAvailableDay = dateCells.find(
            (cell) =>
              cell.textContent?.trim().match(/^\d+$/) &&
              !cell.classList.contains("disabled") &&
              !cell.classList.contains("past") &&
              !cell.classList.contains("empty")
          );
          if (firstAvailableDay) {
            firstAvailableDay.click();
            console.warn(
              `Date Action 3: Day ${desiredDay} failed. Falling back to click the first available day: ${firstAvailableDay.textContent?.trim()}`
            );
          } else {
            console.error(
              "Fatal Error: No available dates found in the current calendar view."
            );
          }
        }
      }, 500);
    } else {
      console.error(`Error: Could not find the trip type option: ${tripType}.`);
    }
  }, 500);
  return true;
}

/**
 * Set Passengers Count
 *
 * @param adults - Number of adult passengers
 * @param children - Number of child passengers
 * @param infants - Number of infant passengers
 * @returns true if successful, false otherwise
 */
export function setPassengers(
  adults: number,
  children: number,
  infants: number
): boolean {
  // 1. Locate the 'المسافرين' input field (the third .booking-item, index 2).
  const bookingItems = document.querySelectorAll<HTMLElement>(".booking-item");
  const passengerItem = bookingItems[2];
  if (!passengerItem) {
    console.error(
      "Error: Could not find the 'المسافرين' booking item (index 2)."
    );
    return false;
  }
  const clickableArea = passengerItem.querySelector<HTMLElement>(".form-value");

  if (!clickableArea) {
    console.error(
      "Error: Could not find the clickable area for 'المسافرين' (.form-value)."
    );
    return false;
  }
  // 2. Click to open the passenger count dropdown.
  clickableArea.click();
  console.log(
    "Passenger Action 1: Clicked to open the passenger selection dropdown."
  );
  // Define the passenger types and their target counts
  const passengerTargets = [
    { type: "بالغ", targetCount: adults },
    { type: "طفل", targetCount: children },
    { type: "رضيع", targetCount: infants },
  ];

  // 3. Wait 500ms for the passenger dropdown to fully appear.
  setTimeout(() => {
    const adjustCount = (type: string, targetCount: number) => {
      // Find the *exact* label element ('بالغ', 'طفل', or 'رضيع') within the dropdown.
      const labelDiv = Array.from(
        document.querySelectorAll<HTMLElement>(".date-dropdown div")
      ).find((div) => div.textContent?.trim() === type);
      if (!labelDiv) {
        console.warn(
          `Warning: Could not find the label div for passenger type: ${type}`
        );
        return;
      }

      // The passenger row is the container that holds the label group (div) and the control group (div).
      // Structure is: <row> -> <div> (label group) -> <labelDiv>
      const passengerRow = labelDiv.closest<HTMLElement>(
        'div[style*="justify-content: space-between"]'
      );
      if (!passengerRow) {
        console.warn(
          `Warning: Could not find the full passenger row container for ${type}.`
        );
        return;
      }

      // The control group (buttons/count display) is the second child of the passengerRow (index 1).
      const controls = passengerRow.children[1] as HTMLElement;

      // Query for controls inside the control group
      const countDisplay = controls?.querySelector<HTMLElement>(
        'div[style*="min-width: 40px"]'
      );
      // The buttons are the first and last child buttons of the controls div
      const decrementButton =
        controls?.querySelector<HTMLButtonElement>("button:first-child");
      const incrementButton =
        controls?.querySelector<HTMLButtonElement>("button:last-child");
      if (!countDisplay || !decrementButton || !incrementButton) {
        console.warn(`Warning: Missing controls (count/buttons) for ${type}.`);
        return;
      }

      let currentCount = parseInt(countDisplay.textContent?.trim() || "0") || 0;
      let clicks = 0;
      // Increase count
      while (currentCount < targetCount) {
        incrementButton.click();
        currentCount++;
        clicks++;
      }
      // Decrease count
      while (currentCount > targetCount) {
        decrementButton.click();
        currentCount--;
        clicks++;
      }
      if (clicks > 0) {
        console.log(
          `Passenger Action: Set ${type} count to ${targetCount} (via ${clicks} clicks).`
        );
      } else {
        console.log(
          `Passenger Action: ${type} count already at ${targetCount}.`
        );
      }
    };
    // Execute adjustment for all passenger types
    passengerTargets.forEach((target) =>
      adjustCount(target.type, target.targetCount)
    );
    // 4. Click the "تطبيق" (Apply) button to close the modal and save the changes.
    // This selector is fine as it targets the class name within the action area.
    const applyButton = document.querySelector<HTMLButtonElement>(
      ".date-dropdown-actions .apply-btn"
    );
    if (applyButton) {
      applyButton.click();
      console.log("Passenger Action 4: Clicked 'تطبيق' (Apply).");
    } else {
      // This error should now be very rare if the dropdown is open
      console.error("Error: Could not find the 'تطبيق' (Apply) button.");
    }
  }, 500);
  return true;
}

/**
 * Fill booking form - unified function for stations, dates, and passengers.
 * All parameters are optional. Only provided fields will be set.
 *
 * @example
 * fillBookingForm({ departureName: "الرياض", arrivalName: "الدمام" }); // stations only
 * fillBookingForm({ tripType: "مسار واحد", departureDateISO: "2026-02-20" }); // dates only
 * fillBookingForm({ adults: 2, children: 1 }); // passengers only
 * fillBookingForm({ departureName: "الرياض", arrivalName: "الدمام", tripType: "مسار واحد", departureDateISO: "2026-02-20", adults: 2 }); // all
 */
export interface FillBookingFormParams {
  departureName?: string;
  arrivalName?: string;
  tripType?: string;
  departureDateISO?: string;
  returnDateISO?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fillBookingForm(
  params: FillBookingFormParams
): Promise<boolean> {
  const {
    departureName,
    arrivalName,
    tripType,
    departureDateISO,
    returnDateISO,
    adults = 0,
    children = 0,
    infants = 0,
  } = params;

  const hasStations =
    departureName && arrivalName && typeof departureName === "string" && typeof arrivalName === "string";
  const hasDates =
    tripType &&
    departureDateISO &&
    typeof tripType === "string" &&
    typeof departureDateISO === "string";
  const hasPassengers =
    typeof adults === "number" && adults >= 0 && (adults > 0 || children > 0 || infants > 0);

  if (!hasStations && !hasDates && !hasPassengers) {
    console.warn(
      "[fillBookingForm] No valid params. Pass at least: (departureName + arrivalName), or (tripType + departureDateISO), or (adults + children + infants)."
    );
    return false;
  }

  let ok = true;

  if (hasStations) {
    ok = selectStations(departureName!, arrivalName!);
    if (!ok) return false;
    await delay(1200);
  }

  if (hasDates) {
    ok = setTripTypeAndDateISO(tripType!, departureDateISO!, returnDateISO);
    if (!ok) return false;
    await delay(5500);
  }

  if (hasPassengers) {
    ok = setPassengers(
      Math.max(1, adults),
      Math.max(0, children),
      Math.max(0, infants)
    );
  }

  return ok;
}

// Make functions available globally on window object (for backward compatibility)
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).selectStations = selectStations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).setTripTypeAndDate = setTripTypeAndDate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).setTripTypeAndDateISO = setTripTypeAndDateISO;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).setPassengers = setPassengers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fillBookingForm = fillBookingForm;
}
