// API endpoint
const API_URL = '/api/feeds';

// Auto-refresh interval (15 minutes)
const AUTO_REFRESH_MS = 15 * 60 * 1000;

// ─── Dark Mode ───
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-toggle').textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('theme-toggle').textContent = '🌙';
        localStorage.setItem('theme', 'light');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// State
let allNews = [];
let currentSection = "all";
let currentSort = "date";
let searchQuery = "";
let showFavoritesOnly = false;
let favorites = loadFavorites();
let autoRefreshTimer = null;
let currentCategory = "all";
let dateFilter = "all";
let currentSource = "all";

// Chart instances
let chartRegion = null;
let chartCategory = null;
let chartSources = null;

// DOM elements
const newsContainer = document.getElementById("news-container");
const loading = document.getElementById("loading");
const noNews = document.getElementById("no-news");
const lastUpdateTime = document.getElementById("last-update-time");
const refreshBtn = document.getElementById("refresh-btn");
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const sortSelect = document.getElementById("sort-select");
const favoritesToggle = document.getElementById("favorites-toggle");
const favCount = document.getElementById("fav-count");
const backToTop = document.getElementById("back-to-top");
const statsContainer = document.getElementById("stats-container");
const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");

// ─── Initialize ───
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupThemeToggle();
    setupNavigation();
    setupRefresh();
    setupSearch();
    setupSort();
    setupFavorites();
    setupAdvancedFilters();
    setupBackToTop();
    setupModal();
    updateFavCount();
    loadNews();
    startAutoRefresh();
});

// ─── Modal Setup ───
function setupModal() {
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modalOverlay.style.display !== 'none') closeModal();
    });
}

// ─── Theme Toggle ───
function setupThemeToggle() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

// ─── Navigation ───
function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelector(".nav-btn.active").classList.remove("active");
            btn.classList.add("active");
            currentSection = btn.dataset.section;
            if (currentSection === "estadisticas") {
                newsContainer.style.display = "none";
                loading.style.display = "none";
                noNews.style.display = "none";
                statsContainer.style.display = "block";
                renderStats();
            } else {
                statsContainer.style.display = "none";
                newsContainer.style.display = "";
                renderNews();
            }
        });
    });
}

// ─── Refresh ───
function setupRefresh() {
    refreshBtn.addEventListener("click", () => {
        loadNews();
    });
}

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        console.log("Auto-refresh activado");
        loadNews();
    }, AUTO_REFRESH_MS);
}

// ─── Search ───
function setupSearch() {
    let debounceTimer;
    searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = searchInput.value.trim().toLowerCase();
            searchClear.style.display = searchQuery ? "block" : "none";
            renderNews();
        }, 250);
    });

    searchClear.addEventListener("click", () => {
        searchInput.value = "";
        searchQuery = "";
        searchClear.style.display = "none";
        renderNews();
    });
}

// ─── Sort ───
function setupSort() {
    sortSelect.addEventListener("change", () => {
        currentSort = sortSelect.value;
        renderNews();
    });
}

// ─── Advanced Filters ───
function setupAdvancedFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dateFilter = btn.dataset.date;
            renderNews();
        });
    });
    document.getElementById('source-select').addEventListener('change', e => {
        currentSource = e.target.value;
        renderNews();
    });
    document.getElementById('category-select').addEventListener('change', e => {
        currentCategory = e.target.value;
        renderNews();
    });
}

function getTrendingNews() {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return allNews
        .filter(item => new Date(item.date).getTime() > cutoff)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 15);
}

function populateSources() {
    const select = document.getElementById('source-select');
    const currentVal = select.value;
    const sources = [...new Set(allNews.map(n => n.source))].sort();
    select.innerHTML = `<option value="all">Todas las fuentes</option>`;
    sources.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        select.appendChild(opt);
    });
    if (sources.includes(currentVal)) select.value = currentVal;
}

// ─── Favorites ───
function loadFavorites() {
    try {
        return JSON.parse(localStorage.getItem("cyberNewsFavorites")) || [];
    } catch {
        return [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem("cyberNewsFavorites", JSON.stringify(favorites));
    } catch { /* ignore */ }
}

function toggleFavorite(newsId) {
    const idx = favorites.indexOf(newsId);
    if (idx > -1) {
        favorites.splice(idx, 1);
    } else {
        favorites.push(newsId);
    }
    saveFavorites();
    updateFavCount();
    renderNews();
}

function isFavorite(newsId) {
    return favorites.includes(newsId);
}

function getNewsId(item) {
    const str = item.title.substring(0, 80) + item.source;
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/[^a-zA-Z0-9]/g, "").substring(0, 40);
}

function updateFavCount() {
    favCount.textContent = favorites.length;
}

function setupFavorites() {
    favoritesToggle.addEventListener("click", () => {
        showFavoritesOnly = !showFavoritesOnly;
        favoritesToggle.classList.toggle("active", showFavoritesOnly);
        favoritesToggle.querySelector(".fav-icon").textContent = showFavoritesOnly ? "★" : "☆";
        renderNews();
    });
}

// ─── Back to Top ───
function setupBackToTop() {
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("visible", window.scrollY > 400);
    });

    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// ─── Update Section Counts ───
function updateCounts() {
    const counts = { all: allNews.length, spain: 0, europe: 0, world: 0, trending: 0 };
    allNews.forEach(item => {
        if (counts[item.region] !== undefined) counts[item.region]++;
    });
    counts.trending = getTrendingNews().length;
    document.getElementById("count-all").textContent = counts.all;
    document.getElementById("count-spain").textContent = counts.spain;
    document.getElementById("count-europe").textContent = counts.europe;
    document.getElementById("count-world").textContent = counts.world;
    document.getElementById("count-trending").textContent = counts.trending;
}

// ─── Load News ───
async function loadNews() {
    loading.style.display = "flex";
    noNews.style.display = "none";
    newsContainer.innerHTML = "";
    refreshBtn.classList.add("spinning");

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        allNews = data.news || [];
        populateSources();

        console.log(`Total: ${data.successFeeds}/${data.totalFeeds} feeds, ${allNews.length} noticias`);

        loading.style.display = "none";
        refreshBtn.classList.remove("spinning");

        if (allNews.length === 0) {
            noNews.style.display = "block";
            noNews.innerHTML = `
                <p>No se pudieron cargar las noticias.</p>
                <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">Pulsa ⟳ para reintentar.</p>
            `;
        }

        const now = new Date();
        lastUpdateTime.textContent = `Actualizado: ${now.toLocaleDateString("es-ES")} ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

        try {
            localStorage.setItem("cyberNewsCache", JSON.stringify({ news: allNews, timestamp: now.toISOString() }));
        } catch { /* ignore */ }

        updateCounts();
        renderNews();
    } catch (error) {
        console.error("Error loading news:", error);
        loading.style.display = "none";
        refreshBtn.classList.remove("spinning");
        noNews.style.display = "block";
        noNews.innerHTML = `
            <p>⚠️ Error al conectar con el servidor.</p>
            <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">Asegúrate de que el servidor está corriendo (npm start).</p>
        `;
    }
}


function cleanText(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.innerHTML = text;
    let cleaned = div.textContent || div.innerText || "";
    cleaned = cleaned.trim().replace(/\s+/g, " ");
    if (cleaned.length > 500) cleaned = cleaned.substring(0, 500);
    return cleaned;
}


// ─── Render News ───
function renderNews() {
    let filtered;

    // Section filter (including trending)
    if (currentSection === "trending") {
        filtered = getTrendingNews();
    } else {
        filtered = currentSection === "all"
            ? [...allNews]
            : allNews.filter(item => item.region === currentSection);
    }

    // Date filter
    if (dateFilter !== "all") {
        const ms = dateFilter === "24h" ? 86400000 : 604800000;
        filtered = filtered.filter(item => Date.now() - new Date(item.date).getTime() < ms);
    }

    // Source filter
    if (currentSource !== "all") {
        filtered = filtered.filter(item => item.source === currentSource);
    }

    // Category filter
    if (currentCategory !== "all") {
        filtered = filtered.filter(item => item.category === currentCategory);
    }

    // Favorites filter
    if (showFavoritesOnly) {
        filtered = filtered.filter(item => isFavorite(getNewsId(item)));
    }

    // Search filter
    if (searchQuery) {
        filtered = filtered.filter(item =>
            item.title.toLowerCase().includes(searchQuery) ||
            item.description.toLowerCase().includes(searchQuery) ||
            item.source.toLowerCase().includes(searchQuery)
        );
    }

    // Sort
    switch (currentSort) {
        case "date":
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case "date-asc":
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case "source":
            filtered.sort((a, b) => a.source.localeCompare(b.source));
            break;
    }

    newsContainer.innerHTML = "";

    if (filtered.length === 0) {
        noNews.style.display = "block";
        if (showFavoritesOnly) {
            noNews.innerHTML = `<p>No tienes favoritos en esta sección.</p>`;
        } else if (searchQuery) {
            noNews.innerHTML = `<p>No se encontraron resultados para "<strong>${escapeHtml(searchQuery)}</strong>".</p>`;
        } else {
            noNews.innerHTML = `<p>No hay noticias en esta categoría.</p>`;
        }
    } else {
        noNews.style.display = "none";
    }

    filtered.forEach((item, i) => {
        const card = createNewsCard(item, i);
        newsContainer.appendChild(card);
    });
}

// ─── Statistics ───
function renderStats() {
    if (chartRegion) { chartRegion.destroy(); chartRegion = null; }
    if (chartCategory) { chartCategory.destroy(); chartCategory = null; }
    if (chartSources) { chartSources.destroy(); chartSources = null; }

    // Chart 1: Por región (doughnut)
    const regionCounts = { spain: 0, europe: 0, world: 0 };
    allNews.forEach(n => { if (regionCounts[n.region] !== undefined) regionCounts[n.region]++; });

    chartRegion = new Chart(document.getElementById('chart-region'), {
        type: 'doughnut',
        data: {
            labels: ['España', 'Europa', 'Mundo'],
            datasets: [{
                data: [regionCounts.spain, regionCounts.europe, regionCounts.world],
                backgroundColor: ['#DF1A21', '#0E3062', '#0098D7'],
                borderWidth: 2
            }]
        },
        options: {
            plugins: { legend: { position: 'bottom' } },
            cutout: '60%'
        }
    });

    // Chart 2: Por categoría (bar)
    const catLabels = {
        vulnerability: 'Vulnerabilidad', malware: 'Malware', phishing: 'Phishing',
        breach: 'Brecha', apt: 'APT', compliance: 'Compliance', tools: 'Herramientas', general: 'General'
    };
    const catColors = {
        vulnerability: '#e67e22', malware: '#e74c3c', phishing: '#9b59b6',
        breach: '#c0392b', apt: '#8e44ad', compliance: '#2980b9', tools: '#1abc9c', general: '#95a5a6'
    };
    const catCounts = {};
    allNews.forEach(n => { catCounts[n.category] = (catCounts[n.category] || 0) + 1; });
    const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    chartCategory = new Chart(document.getElementById('chart-category'), {
        type: 'bar',
        data: {
            labels: catEntries.map(([k]) => catLabels[k] || k),
            datasets: [{
                data: catEntries.map(([, v]) => v),
                backgroundColor: catEntries.map(([k]) => catColors[k] || '#95a5a6'),
                borderRadius: 6
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Chart 3: Top 10 fuentes (bar horizontal)
    const sourceCounts = {};
    allNews.forEach(n => { sourceCounts[n.source] = (sourceCounts[n.source] || 0) + 1; });
    const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    chartSources = new Chart(document.getElementById('chart-sources'), {
        type: 'bar',
        data: {
            labels: topSources.map(([k]) => k),
            datasets: [{
                data: topSources.map(([, v]) => v),
                backgroundColor: '#0098D7',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

// ─── Reading Modal ───
function openReadingModal(item) {
    const regionLabels = { spain: 'España', europe: 'Europa', world: 'Mundo' };
    const categoryLabels = {
        vulnerability: 'Vulnerabilidad', malware: 'Malware', phishing: 'Phishing',
        breach: 'Brecha', apt: 'APT', compliance: 'Compliance', tools: 'Herramientas'
    };

    const imgWrap = document.getElementById('modal-image-wrap');
    imgWrap.innerHTML = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="" class="modal-image" onerror="this.style.display='none'">`
        : '';

    const catLabel = item.category !== 'general' ? categoryLabels[item.category] : null;
    document.getElementById('modal-meta').innerHTML = `
        <span class="card-source">${escapeHtml(item.source)}</span>
        ${catLabel ? `<span class="card-category category-${item.category}">${catLabel}</span>` : ''}
        <span class="card-region region-${item.region}">${regionLabels[item.region]}</span>
        <span class="modal-date">${formatDate(item.date)}</span>
    `;

    document.getElementById('modal-title').textContent = item.title;
    document.getElementById('modal-description').textContent = cleanText(item.description);
    document.getElementById('modal-link').href = item.link;

    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

// ─── Create Card ───
function createNewsCard(item, index) {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = item.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.style.animationDelay = `${Math.min(index * 0.03, 0.5)}s`;
    card.dataset.region = item.region;

    const regionLabels = { spain: "España", europe: "Europa", world: "Mundo" };
    const regionIcons = { spain: "🇪🇸", europe: "🇪🇺", world: "🌍" };
    const categoryLabels = {
        vulnerability: "Vulnerabilidad",
        malware: "Malware",
        phishing: "Phishing",
        breach: "Brecha",
        apt: "APT",
        compliance: "Compliance",
        tools: "Herramientas"
    };

    const date = formatDate(item.date);
    const description = item.description.length > 200
        ? item.description.substring(0, 200) + "..."
        : item.description;

    const newsId = getNewsId(item);
    const isFav = isFavorite(newsId);

    // Is new? (less than 2 hours)
    const isNew = (Date.now() - new Date(item.date).getTime()) < 2 * 60 * 60 * 1000;

    const catLabel = item.category && item.category !== "general" ? categoryLabels[item.category] : null;

    const imageHTML = item.image
        ? `<div class="card-image"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-image-placeholder\\'>${regionIcons[item.region]}</div>'"></div>`
        : `<div class="card-image"><div class="card-image-placeholder">${regionIcons[item.region]}</div></div>`;

    card.innerHTML = `
        ${isNew ? '<span class="card-new-badge">Nueva</span>' : ""}
        <button class="card-fav-btn ${isFav ? "is-fav" : ""}" data-id="${newsId}" title="${isFav ? "Quitar de favoritos" : "Añadir a favoritos"}">${isFav ? "★" : "☆"}</button>
        ${imageHTML}
        <div class="card-body">
            <div class="card-header">
                <span class="card-source">${escapeHtml(item.source)}</span>
                ${catLabel ? `<span class="card-category category-${item.category}">${catLabel}</span>` : ""}
                <span class="card-region region-${item.region}">${regionLabels[item.region]}</span>
            </div>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${description ? `<p class="card-description">${escapeHtml(description)}</p>` : ""}
            <div class="card-footer">
                <span class="card-date">${date}</span>
                <span class="card-link">Leer más →</span>
            </div>
        </div>
    `;

    // Favorite button click (prevent opening link)
    const favBtn = card.querySelector(".card-fav-btn");
    favBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(newsId);
    });

    // Card click — open reading modal instead of external link
    card.addEventListener("click", (e) => {
        if (e.target.closest(".card-fav-btn")) return;  // allow favorite button to work
        e.preventDefault();
        openReadingModal(item);
    });

    return card;
}

// ─── Format Date ───
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Reciente";

        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return "Hace menos de 1 hora";
        if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
        if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;

        return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return "Reciente";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}