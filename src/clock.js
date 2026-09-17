// ============================================================
// Live City Clock Widget
// ------------------------------------------------------------
// Goal: given a city name, show a live, ticking clock for that
// city's local time — accurate, self-correcting, and DST-aware.
//
// Design decisions (why this version differs from a naive one):
//
// 1. Only ONE network call is needed. A city-name -> geocoding
//    lookup (open-meteo) already returns the city's IANA time
//    zone (e.g. "Asia/Kolkata"). We do NOT need a second "what
//    time is it right now" API — the browser's own clock
//    (`new Date()`) already knows the correct instant in time;
//    all we need is to *display* it correctly for another zone.
//
// 2. `Intl.DateTimeFormat` (built into every modern browser)
//    can format a Date object directly into any IANA time zone,
//    including correctly applying that zone's DST rules. This
//    removes the need to manually calculate UTC offsets.
//
// 3. Because each tick re-reads `new Date()` (the real system
//    clock) and reformats it, the clock can never drift. A
//    naive "add 1 second to a stored Date every setInterval"
//    approach silently drifts over time, since timers aren't
//    guaranteed to fire at exactly 1000ms (throttled background
//    tabs, event-loop delays, etc. all cause skew).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // --- Cache DOM references once, instead of re-querying the
  // DOM on every click. Querying is relatively expensive and
  // these elements don't change after page load. ---
  const clockWidget = document.getElementById('clock')       // kept for use elsewhere on the page (e.g. show/hide container) — unused directly in this handler
  const clockItem = document.getElementById('clock-item')    // same as above — kept for parity with the original markup hooks
  const clockCityInput = document.getElementById('clock-city-input')
  const clockBtn = document.getElementById('show-time-button')
  const timeDisplay = document.getElementById('time-display')

  // Holds the interval ID so we can stop a previous clock before
  // starting a new one (e.g. the user looks up a 2nd city without
  // refreshing the page — otherwise two intervals would fight
  // over the same textContent).
  let clockTimer = null

  // --- Step 1: Look up the city -> get its IANA time zone. ---
  // We use open-meteo's free geocoding endpoint. It returns a
  // `timezone` field (e.g. "Europe/Paris") for the top match.
  // This is the ONLY network request this widget needs, because
  // the time zone name is all that's required to compute local
  // time from the device's own accurate clock — no separate
  // "current time" API is necessary.
  async function fetchLocation(cityName) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cityName
    )}&count=1&language=en&format=json`

    const res = await fetch(url)

    if (!res.ok) {
      // Surfaces HTTP-level failures (network reachable, but a
      // bad status code came back, e.g. 500 or 429).
      throw new Error(`Location lookup failed (status ${res.status}).`)
    }

    const data = await res.json()
    const location = data.results?.[0]

    if (!location) {
      // The API itself responded fine, it just found no match —
      // this is a distinct case from a network/HTTP failure, so
      // it gets its own clear message.
      throw new Error('City not found. Try a different spelling.')
    }

    return location // contains .name, .timezone, .country, etc.
  }

  // --- Step 2: Build a formatter for a given time zone. ---
  // Created ONCE per lookup (not once per tick) since
  // constructing an Intl.DateTimeFormat has a small but real
  // cost — no reason to rebuild it 60 times a minute when the
  // time zone itself never changes mid-session.
  function createFormatterFor(timezone) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,     // e.g. "Asia/Kolkata" — the browser
                              // handles the UTC offset AND any
                              // daylight-saving adjustment for us,
                              // for free, correctly, forever.
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  // --- Step 3: Start (or restart) the ticking clock. ---
  function startLiveClock(timezone, cityName) {
    // Always clear any previous timer first — otherwise looking
    // up a second city would leave the old interval running in
    // the background, silently overwriting the display every
    // second with stale data for the wrong city.
    clearInterval(clockTimer)

    const formatter = createFormatterFor(timezone)

    function renderNow() {
      // `new Date()` is the single source of truth for "what
      // time is it right now" — a fresh read of the real system
      // clock on every call. We never store or manually mutate
      // a Date ourselves, so there's nothing that can drift out
      // of sync with real time.
      const now = new Date()
      timeDisplay.textContent = `${cityName}: ${formatter.format(now)}`
      timeDisplay.classList.remove('hidden')
    }

    renderNow()                                  // show immediately — don't make the user wait 1s for the first tick
    clockTimer = setInterval(renderNow, 1000)     // then refresh once a second
  }

  // --- Step 4: Wire up the button. ---
  clockBtn.addEventListener('click', async () => {
    const cityInput = clockCityInput.value.trim()

    // Guard clause: fail fast on empty input before touching
    // the network at all — cheaper and gives instant feedback.
    if (!cityInput) {
      timeDisplay.textContent = 'Please enter a city name.'
      timeDisplay.classList.remove('hidden')
      return
    }

    // Immediate feedback while the geocoding request is in
    // flight, so the UI doesn't look frozen during the fetch.
    timeDisplay.textContent = 'Loading...'
    timeDisplay.classList.remove('hidden')

    try {
      const location = await fetchLocation(cityInput)
      startLiveClock(location.timezone, location.name)
    } catch (error) {
      // Any failure (bad HTTP status, city not found, network
      // drop) lands here with a human-readable message already
      // attached in fetchLocation, so we can show it as-is.
      timeDisplay.textContent = error.message
      timeDisplay.classList.remove('hidden')
    }
  })
})




// document.addEventListener('DOMContentLoaded', () => {
//   const clockWidget = document.getElementById('clock')
//   const clockItem = document.getElementById('clock-item')
//   const clockCityInput = document.getElementById('clock-city-input')
//   const clockBtn = document.getElementById('show-time-button')
//   const timeDisplay = document.getElementById('time-display')

//   let clockTimer = null

//   clockBtn.addEventListener('click', async () => {
//     clearInterval(clockTimer)
//     clockTimer = null

//     const cityInput = clockCityInput.value.trim()
//     if (!cityInput) {
//       timeDisplay.textContent = 'Please enter a city name.'
//       timeDisplay.classList.remove('hidden')
//       return
//     }

//     timeDisplay.textContent = 'Loading...'

//     async function fetchData () {
//       const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
//         cityInput
//       )}&count=1&language=en&format=json`

//       try {
//         const res = await fetch(url)

//         if (!res.ok) {
//           throw new Error(`HTTP error! Status: ${res.status}`)
//         }

//         const data = await res.json()

//         const location = data.results?.[0]
//         if (!location) {
//           throw new Error('city not found.')
//         }

//         const timezone = location.timezone
//         const name = location.name
//         // console.log(name)
//         // console.log(timezone)

//         const timeUrl = `https://timeapi.io/api/time/current/zone?timeZone=${encodeURIComponent(
//           timezone
//         )}`

//         const timeRes = await fetch(timeUrl)

//         if (!timeRes.ok) {
//           throw new Error(`Time API error! Status: ${timeRes.status}`)
//         }

//         const timeData = await timeRes.json()

//         return {
//           location,
//           timeData
//         }
//         // console.log(timeData)
//       } catch (error) {
//         console.log('Fetch failed:', error.message)
//         throw error
//       }
//     }

//     try {
//       const { location, timeData } = await fetchData()

//       startLiveClock(timeData, location)
//     } catch (error) {
//       timeDisplay.textContent = error.message
//       timeDisplay.classList.remove('hidden')
//     }
//   })

//   function formatTime (timeData) {
//     const hours = String(timeData.hour).padStart(2, '0')
//     const minutes = String(timeData.minute).padStart(2, '0')
//     const seconds = String(timeData.seconds).padStart(2, '0')

//     return (
//       `${timeData.day}/${timeData.month}/${timeData.year} ` +
//       `${hours}:${minutes}:${seconds}`
//     )
//   }

//   function startLiveClock (timeData, location) {
//     let currenDate = new Date(
//       Date.UTC(
//         timeData.year,
//         timeData.month - 1,
//         timeData.day,
//         timeData.hour,
//         timeData.minute,
//         timeData.seconds
//       )
//     )

//     function updateDislay () {
//       const currentTimeData = {
//         year: currenDate.getUTCFullYear(),
//         month: currenDate.getUTCMonth() + 1,
//         day: currenDate.getUTCDate(),
//         hour: currenDate.getUTCHours(),
//         minute: currenDate.getUTCMinutes(),
//         seconds: currenDate.getUTCSeconds()
//       }

//       const readableTime = formatTime(currentTimeData)

//       timeDisplay.textContent = `${location.name}: ${readableTime} `

//       timeDisplay.classList.remove('hidden')
//     }

//     updateDislay()

//     clockTimer = setInterval(() => {
//       currenDate.setUTCSeconds(currenDate.getUTCSeconds() + 1)

//       updateDislay()
//     }, 1000)
//   }
// })






// ++++++===========================================================================================================================================


