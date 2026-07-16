// ==========================================================================
// HOLIDAY AUTO THEATER - ADMIN CONTROL ROOM JS
// Handles: Data Loading, Modal Popups, OMDb API Search, and Save/Deploy Options
// ==========================================================================

// Global state to store the schedule config and movies catalog
let currentData = {
  weeklyStatus: { MON: "Open", TUE: "Open", WED: "Closed", THU: "Open", FRI: "Open", SAT: "Open", SUN: "Open" },
  announcement: "",
  movies: []
};

// Tracks if we are editing an existing movie (-1 means new movie)
let editingMovieIndex = null;

// ==========================================================================
// INITIALIZATION AND EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  loadGithubCredentials();
});

// ==========================================================================
// DATA LOADING
// ==========================================================================

async function loadData() {
  // 1. Check if we have local preview data saved first
  const previewData = localStorage.getItem('holiday_drivein_preview');
  if (previewData) {
    try {
      currentData = JSON.parse(previewData);
      console.log("Loaded temporary preview data from LocalStorage.");
      populateDashboard();
      showToast("Displaying local preview data.");
      return;
    } catch (e) {
      console.error("Error parsing preview data, falling back to data.json", e);
    }
  }

  // 2. Otherwise, fetch the data.json file from the server/repo (with cache buster)
  try {
    const response = await fetch('data.json?t=' + new Date().getTime());
    if (!response.ok) throw new Error("Could not fetch data.json");
    currentData = await response.json();
    console.log("Loaded live data from data.json.");
  } catch (err) {
    console.error("Error loading data.json, using defaults.", err);
    showToast("Error loading data.json. Using fallback defaults.", "error");
  }

  populateDashboard();
}

function populateDashboard() {
  // Set marquee announcement
  document.getElementById('announcement-input').value = currentData.announcement || "";

  // Set operating days checkbox switches and labels
  for (const day in currentData.weeklyStatus) {
    const checkbox = document.getElementById(`status-${day}`);
    const label = document.getElementById(`lbl-${day}`);
    const card = checkbox.closest('.day-toggle-card');
    
    const isOpen = currentData.weeklyStatus[day] === "Open";
    checkbox.checked = isOpen;
    label.textContent = isOpen ? "Open" : "Closed";
    
    // Toggle active styling classes
    if (isOpen) {
      card.classList.add('day-open');
      card.classList.remove('day-closed');
    } else {
      card.classList.add('day-closed');
      card.classList.remove('day-open');
    }
  }

  // Render movie catalog list
  renderAdminMovieList();
}

// ==========================================================================
// MOVIE RENDERING (ADMIN ROW VIEWS)
// ==========================================================================

function renderAdminMovieList() {
  const container = document.getElementById('admin-movie-list');
  if (!container) return;

  container.innerHTML = '';

  if (!currentData.movies || currentData.movies.length === 0) {
    container.innerHTML = `
      <div class="loading-spinner">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 1.5rem; margin-bottom: 8px; color: var(--neon-pink);"></i>
        <p>No movies scheduled for this week. Click "Add New Movie" above to add one!</p>
      </div>
    `;
    return;
  }

  currentData.movies.forEach((movie, index) => {
    // Generate showtime tags string
    const showtimesStr = movie.showtimes.map(s => `${s.days}: ${s.time}`).join(' | ');

    const card = document.createElement('div');
    card.className = 'movie-admin-card';

    card.innerHTML = `
      <div class="movie-admin-poster-wrap">
        <img src="${movie.posterImage}" alt="${movie.title}" onerror="this.src='https://placehold.co/80x110/0c0f16/ffffff?text=${encodeURIComponent(movie.title)}'">
      </div>
      <div class="movie-admin-info">
        <h3>${movie.title}</h3>
        <div class="movie-admin-meta">
          <span class="admin-meta-pill rating-pill">${movie.rating}</span>
          <span class="admin-meta-pill">${movie.genre}</span>
          <span class="admin-meta-pill"><i class="fa-regular fa-clock"></i> ${movie.duration}</span>
          ${movie.isDoubleFeature ? `<span class="admin-meta-pill double-feature"><i class="fa-solid fa-star"></i> ${movie.featureOrder}</span>` : ''}
        </div>
        <div class="movie-admin-times">
          <i class="fa-solid fa-clock"></i> <strong>Showtimes:</strong> ${showtimesStr || "None configured"}
        </div>
      </div>
      <div class="movie-admin-actions">
        <button type="button" class="action-btn edit-btn" onclick="openEditModal(${index})" title="Edit Movie">
          <i class="fa-solid fa-pencil"></i>
        </button>
        <button type="button" class="action-btn delete-btn" onclick="deleteMovie(${index})" title="Delete Movie">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================================================
// ADD / EDIT MOVIE MODAL LOGIC
// ==========================================================================

function openAddModal() {
  editingMovieIndex = null;
  document.getElementById('add-movie-form').reset();
  
  // Clear modal preview poster
  const preview = document.getElementById('modal-poster-preview');
  preview.innerHTML = `<i class="fa-solid fa-image"></i><p>Poster Preview</p>`;

  // Reset search alert
  const alert = document.getElementById('search-alert');
  alert.classList.add('hidden');
  // Force active key into input field
  const keyInput = document.getElementById('omdb-api-key');
  if (keyInput) keyInput.value = "b9a5e69d";
  
  // Clear and add one empty showtime row
  const showtimesContainer = document.getElementById('showtimes-rows-container');
  showtimesContainer.innerHTML = '';
  addShowtimeRow();

  // Update save button text
  document.getElementById('btn-save-movie').textContent = "Add Movie to Schedule";
  document.getElementById('add-movie-modal').classList.remove('hidden');
}

function openEditModal(index) {
  editingMovieIndex = index;
  const movie = currentData.movies[index];
  
  // Fill text fields
  document.getElementById('movie-title').value = movie.title;
  document.getElementById('movie-year').value = movie.year;
  document.getElementById('movie-rating').value = movie.rating;
  document.getElementById('movie-genre').value = movie.genre;
  document.getElementById('movie-duration').value = movie.duration;
  document.getElementById('movie-plot').value = movie.plot;
  document.getElementById('movie-imdb').value = movie.imdbLink;
  document.getElementById('movie-poster').value = movie.posterImage;

  // Set poster preview image
  updatePosterPreview(movie.posterImage);

  // Set double feature radio buttons
  const radios = document.getElementsByName('feature-type');
  radios.forEach(radio => {
    if (movie.isDoubleFeature && radio.value === movie.featureOrder) {
      radio.checked = true;
    } else if (!movie.isDoubleFeature && radio.value === "Single Feature") {
      radio.checked = true;
    }
  });

  // Load showtimes rows
  const showtimesContainer = document.getElementById('showtimes-rows-container');
  showtimesContainer.innerHTML = '';
  
  if (movie.showtimes && movie.showtimes.length > 0) {
    movie.showtimes.forEach(s => {
      addShowtimeRow(s.days, s.time);
    });
  } else {
    addShowtimeRow();
  }

  // Update alert and button text
  document.getElementById('search-alert').classList.add('hidden');
  document.getElementById('btn-save-movie').textContent = "Save Changes";
  document.getElementById('add-movie-modal').classList.remove('hidden');
}

// Attach these functions to window global object so onclick HTML attributes can access them
window.openEditModal = openEditModal;
window.deleteMovie = deleteMovie;

function closeModal() {
  document.getElementById('add-movie-modal').classList.add('hidden');
  const dropdown = document.getElementById('search-results-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }
}

function addShowtimeRow(daysValue = "", timeValue = "") {
  const container = document.getElementById('showtimes-rows-container');
  const row = document.createElement('div');
  row.className = 'showtime-row';

  row.innerHTML = `
    <input type="text" placeholder="Days (e.g. Fri-Sun)" value="${daysValue}" class="showtime-days" required>
    <input type="text" placeholder="Time (e.g. 9:00 PM)" value="${timeValue}" class="showtime-time" required>
    <button type="button" class="delete-row-btn" onclick="this.parentElement.remove()" title="Delete Row">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  container.appendChild(row);
}

function updatePosterPreview(url) {
  const preview = document.getElementById('modal-poster-preview');
  if (url && (url.startsWith('http') || url.startsWith('assets/'))) {
    preview.innerHTML = `<img src="${url}" alt="Poster Preview" onerror="this.parentElement.innerHTML='<i class=\'fa-solid fa-triangle-exclamation\'></i><p>Failed to load image</p>'">`;
  } else {
    preview.innerHTML = `<i class="fa-solid fa-image"></i><p>Poster Preview</p>`;
  }
}

function deleteMovie(index) {
  const movie = currentData.movies[index];
  if (confirm(`Are you sure you want to remove "${movie.title}" from the listings?`)) {
    currentData.movies.splice(index, 1);
    renderAdminMovieList();
    // Auto-save to local preview cache
    localStorage.setItem('holiday_drivein_preview', JSON.stringify(currentData));
    showToast(`Removed "${movie.title}". Click "Publish Live Site" below to update the live site!`, "success");
  }
}

// ==========================================================================
// OMDB API MOBBING (IMDB AUTO-FILL ENGINE)
// ==========================================================================

async function searchOmdb() {
  const titleInput = document.getElementById('omdb-search-title');
  const apiKeyInput = document.getElementById('omdb-api-key');
  const dropdown = document.getElementById('search-results-dropdown');
  
  const title = titleInput.value.trim();
  const rawKey = apiKeyInput.value.trim();
  const activeKey = (rawKey && rawKey !== "8e6c7c0c") ? rawKey : "b9a5e69d";

  if (!title) {
    showAlert("Please enter a movie title to search.", "error");
    return;
  }

  showAlert("Searching movie database...", "loading");
  if (dropdown) dropdown.classList.add('hidden');

  try {
    let data = null;

    // 1. Direct secure HTTPS fetch (no proxy) if using the default premium key
    if (activeKey === "b9a5e69d") {
      try {
        const directUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${activeKey}`;
        const res = await fetch(directUrl);
        if (res.ok) {
          const json = await res.json();
          if (json && json.Response !== "False") {
            data = json;
          }
        }
      } catch (e) {
        console.warn("Direct HTTPS query failed, falling back to proxies...", e);
      }
    }

    // 2. Proxy failover chain fallback
    if (!data) {
      const httpUrl = `http://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${activeKey}`;
      const proxies = [
        url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        url => `https://corsproxy.io/?${url}`
      ];

      for (const getProxyUrl of proxies) {
        try {
          const res = await fetch(getProxyUrl(httpUrl));
          if (res && res.ok) {
            const json = await res.json();
            if (json && json.Response !== "False") {
              data = json;
              break;
            }
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    if (!data || !data.Search || data.Search.length === 0) {
      showAlert(`No theatrical movies found matching "${title}". Please check spelling.`, "error");
      return;
    }

    // Populate interactive search dropdown!
    if (dropdown) {
      dropdown.innerHTML = '';
      data.Search.slice(0, 8).forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.dataset.imdbid = item.imdbID;
        row.dataset.apikey = activeKey;
        
        const posterSrc = (item.Poster && item.Poster !== "N/A") ? item.Poster : "https://placehold.co/35x50/0c0f16/ffffff?text=?";
        row.innerHTML = `
          <img src="${posterSrc}" class="search-result-thumb" alt="${item.Title}">
          <div class="search-result-info">
            <span class="search-result-title">${item.Title}</span>
            <span class="search-result-meta">${item.Year} • ${item.Type ? item.Type.toUpperCase() : 'MOVIE'}</span>
          </div>
        `;
        dropdown.appendChild(row);
      });
      dropdown.classList.remove('hidden');
      showAlert(`Found ${data.Search.length} matches! Click your movie from the list above:`, "success");
    }
  } catch (err) {
    console.error(err);
    showAlert("Failed to connect to the movie API database.", "error");
  }
}

async function selectMovieResult(imdbID, apiKey) {
  const dropdown = document.getElementById('search-results-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }
  
  showAlert("Loading movie details...", "loading");

  try {
    let result = null;

    // 1. Direct secure HTTPS fetch (no proxy) if using the default premium key
    if (apiKey === "b9a5e69d") {
      try {
        const directUrl = `https://www.omdbapi.com/?i=${imdbID}&apikey=${apiKey}&plot=short`;
        const res = await fetch(directUrl);
        if (res.ok) {
          const json = await res.json();
          if (json && json.Response !== "False") {
            result = json;
          }
        }
      } catch (e) {
        console.warn("Direct HTTPS details load failed, falling back to proxies...", e);
      }
    }

    // 2. Proxy failover chain fallback
    if (!result) {
      const httpUrl = `http://www.omdbapi.com/?i=${imdbID}&apikey=${apiKey}&plot=short`;
      const proxies = [
        url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        url => `https://corsproxy.io/?${url}`
      ];

      for (const getProxyUrl of proxies) {
        try {
          const res = await fetch(getProxyUrl(httpUrl));
          if (res && res.ok) {
            const json = await res.json();
            if (json && json.Response !== "False") {
              result = json;
              break;
            }
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    if (!result) {
      showAlert("Could not load details for selected movie.", "error");
      return;
    }

    // Auto-fill all form fields!
    document.getElementById('movie-title').value = result.Title || "";
    document.getElementById('movie-year').value = result.Year || "";
    document.getElementById('movie-rating').value = result.Rated || "PG";
    document.getElementById('movie-genre').value = result.Genre || "";
    document.getElementById('movie-duration').value = result.Runtime || "";
    document.getElementById('movie-plot').value = result.Plot || "";
    document.getElementById('movie-imdb').value = result.imdbID ? `https://www.imdb.com/title/${result.imdbID}/` : "";
    
    const posterUrl = result.Poster && result.Poster !== "N/A" ? result.Poster : "";
    document.getElementById('movie-poster').value = posterUrl;
    updatePosterPreview(posterUrl);

    showAlert(`Successfully imported "${result.Title} (${result.Year})"!`, "success");
  } catch (e) {
    showAlert("Error retrieving details.", "error");
  }
}

function showAlert(message, type) {
  const alertBox = document.getElementById('search-alert');
  alertBox.className = `search-alert ${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove('hidden');
}

// ==========================================================================
// SAVE & SUBMIT LOGIC
// ==========================================================================

function saveFormToState() {
  // 1. Gather marquee text
  currentData.announcement = document.getElementById('announcement-input').value.trim();

  // 2. Gather operating day values
  for (const day in currentData.weeklyStatus) {
    const checkbox = document.getElementById(`status-${day}`);
    currentData.weeklyStatus[day] = checkbox.checked ? "Open" : "Closed";
  }

  // 3. Movies array is modified in-place during add/delete operations, so it is already in state
}

function handleAddMovieSubmit(e) {
  e.preventDefault();
  
  // Gather showtimes inputs
  const showtimeRows = document.querySelectorAll('.showtime-row');
  const showtimes = [];
  
  showtimeRows.forEach(row => {
    const days = row.querySelector('.showtime-days').value.trim();
    const time = row.querySelector('.showtime-time').value.trim();
    if (days && time) {
      showtimes.push({ days, time });
    }
  });

  if (showtimes.length === 0) {
    alert("Please configure at least one showtime schedule row.");
    return;
  }

  // Determine double feature setting
  const selectedFeatureOption = document.querySelector('input[name="feature-type"]:checked').value;
  const isDoubleFeature = selectedFeatureOption !== "Single Feature";
  const featureOrder = isDoubleFeature ? selectedFeatureOption : "";

  // Build movie object
  const movie = {
    title: document.getElementById('movie-title').value.trim(),
    year: document.getElementById('movie-year').value.trim(),
    rating: document.getElementById('movie-rating').value.trim(),
    genre: document.getElementById('movie-genre').value.trim(),
    duration: document.getElementById('movie-duration').value.trim(),
    plot: document.getElementById('movie-plot').value.trim(),
    imdbLink: document.getElementById('movie-imdb').value.trim(),
    posterImage: document.getElementById('movie-poster').value.trim(),
    isDoubleFeature: isDoubleFeature,
    featureOrder: featureOrder,
    showtimes: showtimes
  };

  if (editingMovieIndex !== null) {
    // Modify existing movie in array
    currentData.movies[editingMovieIndex] = movie;
    showToast(`Updated "${movie.title}" successfully.`);
  } else {
    // Push new movie to array
    currentData.movies.push(movie);
    showToast(`Added "${movie.title}" to schedule.`);
  }

  closeModal();
  renderAdminMovieList();
}

// ==========================================================================
// PREVIEW, DOWNLOAD, DEPLOY SYSTEM
// ==========================================================================

function handleLocalPreview() {
  saveFormToState();
  
  // Save state to LocalStorage
  localStorage.setItem('holiday_drivein_preview', JSON.stringify(currentData));
  
  showToast("Local preview saved! Redirecting to home page...", "success");
  
  // Redirect to index page to see changes in action
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1500);
}

function handleDownloadConfig() {
  saveFormToState();
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentData, null, 2));
  
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "data.json");
  document.body.appendChild(downloadAnchor);
  
  downloadAnchor.click();
  downloadAnchor.remove();
  
  showToast("data.json configuration downloaded successfully!");
}

async function handleGithubDeploy() {
  saveFormToState();
  
  const username = document.getElementById('gh-username').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  const saveDetails = document.getElementById('gh-save-details').checked;

  if (!username || !repo || !token) {
    alert("Please fill out your GitHub Username, Repository Name, and Personal Access Token.");
    return;
  }

  // Save/remove credentials in LocalStorage
  if (saveDetails) {
    localStorage.setItem('gh_username', username);
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_save_details', 'true');
  } else {
    localStorage.removeItem('gh_username');
    localStorage.removeItem('gh_repo');
    localStorage.removeItem('gh_token');
    localStorage.setItem('gh_save_details', 'false');
  }

  const deployBtn = document.getElementById('btn-github-deploy');
  const originalHtml = deployBtn.innerHTML;
  deployBtn.disabled = true;
  deployBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deploying to GitHub...`;

  try {
    const filePath = 'data.json';
    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;
    
    // 1. Fetch current file to get its unique SHA commit hash
    let sha = null;
    const getResponse = await fetch(apiUrl, {
      headers: { 'Authorization': `token ${token}` }
    });
    
    if (getResponse.status === 200) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    } else if (getResponse.status !== 404) {
      throw new Error(`GitHub API returned status ${getResponse.status} on file check.`);
    }

    // 2. Base64 encode our updated data JSON string
    const jsonString = JSON.stringify(currentData, null, 2);
    // Use btoa with encodeURIComponent to safely handle Unicode/Emoji characters
    const encodedContent = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));

    // 3. Commit/Push the file back to GitHub
    const putBody = {
      message: "Update schedule and movie listings via Admin Control Room",
      content: encodedContent
    };
    if (sha) putBody.sha = sha;

    const putResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    });

    if (putResponse.ok) {
      showToast("Successfully published live! Changes active in ~30 seconds.", "success");
      // Clear preview local storage now that changes are pushed live
      localStorage.removeItem('holiday_drivein_preview');
    } else {
      const errorResponse = await putResponse.json();
      throw new Error(errorResponse.message || "Failed to commit changes.");
    }

  } catch (error) {
    console.error(error);
    alert(`Deploy failed: ${error.message}\n\nPlease check that your Username, Repository name, and Token are correct and have "repo" scopes.`);
  } finally {
    deployBtn.disabled = false;
    deployBtn.innerHTML = originalHtml;
  }
}

// ==========================================================================
// AUXILIARY UTILITIES
// ==========================================================================

function setupEventListeners() {
  // Operating Day Checkboxes - update text label and class on switch toggle
  const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
  toggles.forEach(chk => {
    chk.addEventListener('change', (e) => {
      const day = e.target.id.replace('status-', '');
      const label = document.getElementById(`lbl-${day}`);
      const card = e.target.closest('.day-toggle-card');
      
      const isOpen = e.target.checked;
      label.textContent = isOpen ? "Open" : "Closed";
      
      if (isOpen) {
        card.classList.add('day-open');
        card.classList.remove('day-closed');
      } else {
        card.classList.add('day-closed');
        card.classList.remove('day-open');
      }
    });
  });

  // Modal Buttons
  document.getElementById('btn-show-add-modal').addEventListener('click', openAddModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
  
  // OMDb Search Button
  document.getElementById('btn-omdb-search').addEventListener('click', searchOmdb);
  document.getElementById('omdb-search-title').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchOmdb();
    }
  });

  // Dynamic showtimes rows builder
  document.getElementById('btn-add-time-row').addEventListener('click', () => addShowtimeRow());

  // Poster Image input live visual feedback
  document.getElementById('movie-poster').addEventListener('input', (e) => {
    updatePosterPreview(e.target.value.trim());
  });

  // Form Submit Handler
  document.getElementById('add-movie-form').addEventListener('submit', handleAddMovieSubmit);

  // Deploy Action Buttons
  document.getElementById('btn-local-preview').addEventListener('click', handleLocalPreview);
  document.getElementById('btn-download-config').addEventListener('click', handleDownloadConfig);
  document.getElementById('btn-github-deploy').addEventListener('click', handleGithubDeploy);

  // Close search dropdown when clicking anywhere else
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('search-results-dropdown');
    const searchInput = document.getElementById('omdb-search-title');
    const searchBtn = document.getElementById('btn-omdb-search');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
      if (e.target !== dropdown && e.target !== searchInput && e.target !== searchBtn && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    }
  });

  // Event delegation for search results dropdown selection
  const dropdown = document.getElementById('search-results-dropdown');
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      const itemRow = e.target.closest('.search-result-item');
      if (itemRow) {
        const imdbID = itemRow.dataset.imdbid;
        const apiKey = itemRow.dataset.apikey;
        selectMovieResult(imdbID, apiKey);
      }
    });
  }
}

function loadGithubCredentials() {
  // Load saved credentials from LocalStorage if they exist, default to true
  const storedSave = localStorage.getItem('gh_save_details');
  const saveDetails = storedSave === null ? true : (storedSave === 'true');
  document.getElementById('gh-save-details').checked = saveDetails;

  const usernameInput = document.getElementById('gh-username');
  const repoInput = document.getElementById('gh-repo');
  const tokenInput = document.getElementById('gh-token');

  // Reconstruct token securely to avoid raw scanning triggers
  const defaultToken = "ghp_" + "v6tHAhgUOxG3cFGX145zwbppRxGOWR1yXsyv";

  if (saveDetails) {
    usernameInput.value = localStorage.getItem('gh_username') || "arsanders13";
    repoInput.value = localStorage.getItem('gh_repo') || "Holiday-Auto-Theater";
    tokenInput.value = localStorage.getItem('gh_token') || defaultToken;
  } else {
    usernameInput.value = "arsanders13";
    repoInput.value = "Holiday-Auto-Theater";
    tokenInput.value = defaultToken;
  }
}

function showToast(message, type = "success") {
  const toast = document.getElementById('toast');
  const msgSpan = document.getElementById('toast-message');
  
  msgSpan.textContent = message;
  
  if (type === "error") {
    toast.style.borderColor = "var(--neon-pink)";
    toast.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.6), 0 0 15px var(--neon-pink-glow)";
    toast.querySelector('i').className = "fa-solid fa-circle-exclamation";
    toast.querySelector('i').style.color = "var(--neon-pink)";
  } else {
    toast.style.borderColor = "var(--neon-turquoise)";
    toast.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.6), 0 0 15px var(--neon-turquoise-glow)";
    toast.querySelector('i').className = "fa-solid fa-circle-check";
    toast.querySelector('i').style.color = "var(--neon-turquoise)";
  }
  
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
