// ==========================================================================
// DYNAMIC SITE DATA STATE
// Loads configuration from LocalStorage (preview) or fetches data.json (live).
// Falls back to static values if fetched/blocked by CORS in local file mode.
// ==========================================================================

let liveData = {
  weeklyStatus: {
    MON: "Open", TUE: "Open", WED: "Closed", THU: "Open", FRI: "Open", SAT: "Open", SUN: "Open"
  },
  announcement: "★ NOW SHOWING • CHECK WEEKLY SCHEDULE GRID BELOW FOR OPEN DAYS ★ SOUND ON 88.3 FM ★ GATES OPEN AT 7:30 PM ★ SHOWTIME AT DUSK ★ POPCORN IS POPPING! ★",
  movies: [
    {
      title: "Obsession",
      year: "2026",
      rating: "R",
      genre: "Horror",
      duration: "108m",
      plot: "After breaking the mysterious 'One Wish Willow' to win his crush's heart, a hopeless romantic finds himself getting exactly what he asked for but soon discovers that some desires come at a dark, sinister price.",
      imdbLink: "https://www.imdb.com/title/tt37287335",
      posterImage: "assets/141_obsession.jpg",
      isDoubleFeature: true,
      featureOrder: "First Feature",
      showtimes: [{ "days": "Thurs", "time": "9:20 PM" }]
    },
    {
      title: "Grease",
      year: "1978",
      rating: "PG",
      genre: "Musical / Romance",
      duration: "1h 50m",
      plot: "Good girl Sandy Olsson and greaser Danny Zuko fell in love over the summer. When they unexpectedly discover they're now in the same high school, will they be able to rekindle their romance?",
      imdbLink: "https://www.imdb.com/title/tt0077631/",
      posterImage: "assets/poster_grease.jpg",
      isDoubleFeature: true,
      featureOrder: "Second Feature",
      showtimes: [
        { "days": "Fri - Sun", "time": "11:10 PM" },
        { "days": "Mon, Tue, Thu", "time": "11:15 PM" }
      ]
    }
  ]
};

// ==========================================================================
// INITIALIZATION AND EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteData();
  renderPreviewBannerIfNeeded();
  updateMarqueeAnnouncements();
  renderScheduleGrid();
  renderMovies();
  setupTabs();
  setupContactForm();
});

// ==========================================================================
// SITE DATA ENGINE
// ==========================================================================

async function loadSiteData() {
  // 1. Check if we have local preview data saved from Admin Control Room
  const preview = localStorage.getItem('holiday_drivein_preview');
  if (preview) {
    try {
      liveData = JSON.parse(preview);
      console.log("Loaded local preview site configuration.");
      return;
    } catch (e) {
      console.error("Error parsing local preview data", e);
    }
  }

  // 2. Fetch live data.json from repo
  try {
    const response = await fetch('data.json?t=' + new Date().getTime());
    if (!response.ok) throw new Error("Network response not ok");
    liveData = await response.json();
    console.log("Loaded live site configuration from data.json.");
  } catch (err) {
    // Falls back silently to the hardcoded `liveData` object above, 
    // ensuring local file:// previews do not break due to CORS.
    console.warn("Could not fetch data.json. Falling back to local copy.", err);
  }
}

function renderPreviewBannerIfNeeded() {
  const preview = localStorage.getItem('holiday_drivein_preview');
  if (preview) {
    // Create preview banner element at the very top of body
    const banner = document.createElement('div');
    banner.className = 'preview-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <span>⚡ <strong>PREVIEW MODE</strong>: Viewing local changes saved in this browser.</span>
        <div class="banner-actions">
          <a href="admin.html" class="banner-btn admin-btn"><i class="fa-solid fa-sliders"></i> Admin Room</a>
          <button class="banner-btn discard-btn" id="btn-discard-preview"><i class="fa-solid fa-trash-can"></i> Discard Preview</button>
        </div>
      </div>
    `;
    
    document.body.prepend(banner);
    
    // Discard preview listener
    document.getElementById('btn-discard-preview').addEventListener('click', () => {
      localStorage.removeItem('holiday_drivein_preview');
      window.location.reload();
    });
  }
}

function updateMarqueeAnnouncements() {
  const marqueeSpans = document.querySelectorAll('.marquee-content span');
  if (marqueeSpans.length > 0 && liveData.announcement) {
    marqueeSpans.forEach(span => {
      span.textContent = liveData.announcement;
    });
  }
}

// ==========================================================================
// DYNAMIC SCHEDULE GRID ENGINE (Starts on Monday, updates calendar dates)
// ==========================================================================

function renderScheduleGrid() {
  const scheduleContainer = document.getElementById('schedule-days-grid');
  if (!scheduleContainer) return;

  scheduleContainer.innerHTML = '';

  const standardDayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Shift day names to start from today (displaying 7 days total: today + next 6 days)
  const dayNames = [];
  for (let i = 0; i < 7; i++) {
    const dayIndex = (currentDayOfWeek + i) % 7;
    dayNames.push(standardDayNames[dayIndex]);
  }

  dayNames.forEach((name, index) => {
    // Determine status and class dynamically from configuration
    const status = liveData.weeklyStatus[name] || "Open";
    const isClosed = status.toLowerCase() === "closed";
    const boxClass = isClosed ? "closed-day" : "active-day";

    // Calculate date for this day box (today + index)
    const thisDay = new Date(today);
    thisDay.setDate(today.getDate() + index);

    // Format date string (e.g. "Jun 15")
    const options = { month: 'short', day: 'numeric' };
    const dateString = thisDay.toLocaleDateString('en-US', options);

    // This day is today if it's the first element (index === 0)
    const isToday = index === 0;
    const todayBadge = isToday ? '<span class="today-badge">TODAY</span>' : '';

    const dayBox = document.createElement('div');
    dayBox.className = `day-box ${boxClass} ${isToday ? 'today-highlight' : ''}`;

    dayBox.innerHTML = `
      <span class="day-name">${name}</span>
      <span class="day-date">${dateString}</span>
      <span class="day-status">${status}</span>
      ${todayBadge}
    `;

    scheduleContainer.appendChild(dayBox);
  });
}

// ==========================================================================
// MOVIE RENDERING ENGINE
// ==========================================================================

function renderMovies() {
  const listingsContainer = document.getElementById('movie-listings');
  if (!listingsContainer) return;

  // Clear any loading markers or placeholder items
  listingsContainer.innerHTML = '';

  if (liveData.movies.length === 0) {
    listingsContainer.innerHTML = `
      <div class="movie-card loading-card">
        <p><i class="fa-solid fa-circle-exclamation"></i> No movies scheduled for this week. Check back soon!</p>
      </div>
    `;
    return;
  }

  liveData.movies.forEach(movie => {
    // Generate showtime list items
    let showtimeListHTML = '';
    movie.showtimes.forEach(sched => {
      showtimeListHTML += `
        <li>
          <span>${sched.days}:</span>
          <span class="show-time">${sched.time}</span>
        </li>
      `;
    });

    // Create card element
    const card = document.createElement('div');
    card.className = 'movie-card';

    card.innerHTML = `
      ${movie.isDoubleFeature ? `<div class="double-feature-tag">${movie.featureOrder}</div>` : ''}
      <div class="movie-poster-frame">
        <img src="${movie.posterImage}" alt="${movie.title} Poster" class="movie-poster" onerror="this.src='https://placehold.co/240x350/10141e/ffffff?text=${encodeURIComponent(movie.title)}'">
      </div>
      <div class="movie-details">
        <div class="movie-header-block">
          <div class="movie-title-box">
            <h4>${movie.title}</h4>
            <span class="meta-pill rating-pill">${movie.rating}</span>
          </div>
          <div class="movie-meta-pills">
            <span class="meta-pill genre-pill">${movie.genre}</span>
            <span class="meta-pill"><i class="fa-regular fa-clock"></i> ${movie.duration}</span>
            <span class="meta-pill"><i class="fa-solid fa-calendar"></i> ${movie.year}</span>
          </div>
          <p class="movie-plot">${movie.plot}</p>
        </div>
        
        <div class="showtime-ticket-board">
          <h5><i class="fa-solid fa-ticket"></i> Showtime Schedule</h5>
          <ul>
            ${showtimeListHTML}
          </ul>
        </div>
        
        <div class="movie-action-buttons">
          <a href="${movie.imdbLink}" target="_blank" rel="noopener noreferrer" class="btn-imdb" id="btn-imdb-${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
            <i class="fa-brands fa-imdb"></i> IMDb Details
          </a>
        </div>
      </div>
    `;

    listingsContainer.appendChild(card);
  });
}

// ==========================================================================
// TAB NAVIGATION SCRIPT
// ==========================================================================

function setupTabs() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all nav buttons
      navButtons.forEach(b => b.classList.remove('active'));
      // Activate clicked button
      btn.classList.add('active');

      // Hide all tabs
      tabContents.forEach(content => content.classList.remove('active-tab'));

      // Show targeted tab
      const targetTabId = btn.getAttribute('data-tab');
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) {
        targetTab.classList.add('active-tab');

        // Scroll to the main content area (especially useful on mobile)
        const mainContentElement = document.querySelector('.main-content');
        if (mainContentElement) {
          window.scrollTo({
            top: mainContentElement.offsetTop - 70,
            behavior: 'smooth'
          });
        }
      }
    });
  });
}

// ==========================================================================
// RETRO POSTCARD CONTACT FORM HANDLER
// ==========================================================================

function setupContactForm() {
  const contactForm = document.getElementById('contact-form');
  const successOverlay = document.getElementById('form-success-overlay');
  const resetBtn = document.getElementById('btn-success-reset');

  if (contactForm && successOverlay) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Collect message details
      const name = document.getElementById('contact-name').value;
      const email = document.getElementById('contact-email').value;
      const subject = document.getElementById('contact-subject').value;
      const message = document.getElementById('contact-message').value;

      console.log(`Sending postcard from: ${name} (${email}) | Subject: ${subject}`);
      console.log(`Message: ${message}`);

      // Transition to success overlay (simulating mail delivery)
      successOverlay.classList.remove('hidden');
      contactForm.reset();
    });
  }

  if (resetBtn && successOverlay) {
    resetBtn.addEventListener('click', () => {
      // Slide success overlay back to reveal the postcard form
      successOverlay.classList.add('hidden');
    });
  }
}
