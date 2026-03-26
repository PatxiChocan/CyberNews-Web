// RSS Feed Sources organized by region
const FEEDS = {
    spain: [
        {
            name: "INCIBE",
            url: "https://www.incibe.es/incibe/sala-de-prensa/notas-de-prensa/rss",
            region: "spain"
        },
        {
            name: "INCIBE-CERT",
            url: "https://www.incibe.es/incibe-cert/alerta-temprana/avisos/rss",
            region: "spain"
        }
    ],
    europe: [
        {
            name: "ENISA",
            url: "https://www.enisa.europa.eu/publications/rss.xml",
            region: "europe"
        }
    ],
    world: [
        {
            name: "The Hacker News",
            url: "https://feeds.feedburner.com/TheHackersNews",
            region: "world"
        },
        {
            name: "BleepingComputer",
            url: "https://www.bleepingcomputer.com/feed/",
            region: "world"
        },
        {
            name: "Krebs on Security",
            url: "https://krebsonsecurity.com/feed/",
            region: "world"
        },
        {
            name: "SecurityWeek",
            url: "https://www.securityweek.com/feed/",
            region: "world"
        },
        {
            name: "Dark Reading",
            url: "https://www.darkreading.com/rss.xml",
            region: "world"
        }
    ]
};

// Multiple CORS proxies as fallbacks
const PROXIES = [
    (url) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// State
let allNews = [];
let currentSection = "all";

// DOM elements
const newsContainer = document.getElementById("news-container");
const loading = document.getElementById("loading");
const errorMsg = document.getElementById("error");
const noNews = document.getElementById("no-news");
const lastUpdateTime = document.getElementById("last-update-time");
const refreshBtn = document.getElementById("refresh-btn");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupRefresh();
    loadNews();
});

function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelector(".nav-btn.active").classList.remove("active");
            btn.classList.add("active");
            currentSection = btn.dataset.section;
            renderNews();
        });
    });
}

function setupRefresh() {
    refreshBtn.addEventListener("click", () => {
        loadNews();
    });
}

async function loadNews() {
    loading.style.display = "flex";
    errorMsg.style.display = "none";
    noNews.style.display = "none";
    newsContainer.innerHTML = "";
    refreshBtn.classList.add("spinning");

    const allFeeds = [
        ...FEEDS.spain,
        ...FEEDS.europe,
        ...FEEDS.world
    ];

    console.log(`Intentando cargar ${allFeeds.length} feeds...`);

    const results = await Promise.allSettled(
        allFeeds.map(feed => fetchFeedWithRetry(feed))
    );

    allNews = [];
    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value && result.value.length > 0) {
            allNews.push(...result.value);
            successCount++;
            console.log(`✅ ${allFeeds[i].name}: ${result.value.length} noticias`);
        } else {
            errorCount++;
            console.warn(`❌ ${allFeeds[i].name}: sin resultados`);
        }
    });

    console.log(`Resultado: ${successCount} feeds OK, ${errorCount} fallidos, ${allNews.length} noticias total`);

    // Sort by date, newest first
    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Remove duplicates by title similarity
    allNews = removeDuplicates(allNews);

    loading.style.display = "none";
    refreshBtn.classList.remove("spinning");

    if (errorCount > 0 && allNews.length > 0) {
        errorMsg.style.display = "block";
        errorMsg.querySelector("p").textContent =
            `⚠️ ${errorCount} de ${allFeeds.length} fuentes no pudieron cargarse. Mostrando ${allNews.length} noticias disponibles.`;
    }

    if (allNews.length === 0) {
        noNews.style.display = "block";
        noNews.innerHTML = `
            <p>⚠️ No se pudieron cargar las noticias.</p>
            <p style="margin-top:0.5rem;font-size:0.85rem;color:#8892a4;">
                Esto puede ocurrir si los proxies CORS están saturados.<br>
                Abre la consola del navegador (F12) para ver detalles.<br>
                Pulsa ⟳ para reintentar.
            </p>
        `;
    }

    // Update timestamp
    const now = new Date();
    lastUpdateTime.textContent = `Última actualización: ${now.toLocaleDateString("es-ES")} ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

    // Cache news
    try {
        localStorage.setItem("cyberNewsCache", JSON.stringify({
            news: allNews,
            timestamp: now.toISOString()
        }));
    } catch (e) { /* ignore */ }

    renderNews();
}

// Try each proxy until one works
async function fetchFeedWithRetry(feed) {
    // Proxy 0: rss2json (returns JSON directly)
    try {
        const res = await fetch(PROXIES[0](feed.url), { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const data = await res.json();
            if (data.status === "ok" && data.items && data.items.length > 0) {
                console.log(`  ${feed.name}: rss2json OK`);
                return data.items.map(item => ({
                    title: cleanText(item.title),
                    description: cleanText(item.description || item.content || ""),
                    link: item.link,
                    date: item.pubDate || new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                }));
            }
        }
    } catch (e) {
        console.log(`  ${feed.name}: rss2json falló (${e.message})`);
    }

    // Proxy 1 & 2: return raw XML, need parsing
    for (let i = 1; i < PROXIES.length; i++) {
        try {
            const res = await fetch(PROXIES[i](feed.url), { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const text = await res.text();
                const items = parseRSS(text, feed);
                if (items && items.length > 0) {
                    console.log(`  ${feed.name}: proxy ${i} OK`);
                    return items;
                }
            }
        } catch (e) {
            console.log(`  ${feed.name}: proxy ${i} falló (${e.message})`);
        }
    }

    return null;
}

function parseRSS(xml, feed) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");

        // Check for parse errors
        if (doc.querySelector("parsererror")) {
            // Maybe it's HTML wrapped - try to extract from CDATA or content
            return null;
        }

        // Try RSS 2.0 format
        let items = doc.querySelectorAll("item");
        if (items.length > 0) {
            return Array.from(items).slice(0, 20).map(item => {
                const linkEl = item.querySelector("link");
                let link = "#";
                if (linkEl) {
                    // Sometimes <link> text is in nextSibling due to XML parsing quirks
                    link = linkEl.textContent?.trim() || linkEl.getAttribute("href") || "#";
                }

                return {
                    title: cleanText(item.querySelector("title")?.textContent || ""),
                    description: cleanText(
                        item.querySelector("description")?.textContent ||
                        getElementByTagNS(item, "encoded") || ""
                    ),
                    link: link,
                    date: item.querySelector("pubDate")?.textContent ||
                          getElementByTagNS(item, "date") ||
                          new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                };
            }).filter(item => item.title);
        }

        // Try Atom format
        const entries = doc.querySelectorAll("entry");
        if (entries.length > 0) {
            return Array.from(entries).slice(0, 20).map(entry => ({
                title: cleanText(entry.querySelector("title")?.textContent || ""),
                description: cleanText(
                    entry.querySelector("summary")?.textContent ||
                    entry.querySelector("content")?.textContent || ""
                ),
                link: entry.querySelector("link")?.getAttribute("href") ||
                      entry.querySelector("link")?.textContent || "#",
                date: entry.querySelector("published")?.textContent ||
                      entry.querySelector("updated")?.textContent ||
                      new Date().toISOString(),
                source: feed.name,
                region: feed.region
            })).filter(item => item.title);
        }

        return null;
    } catch {
        return null;
    }
}

// Helper to get namespaced elements like content:encoded, dc:date
function getElementByTagNS(parent, localName) {
    const children = parent.children;
    for (let i = 0; i < children.length; i++) {
        if (children[i].localName === localName) {
            return children[i].textContent;
        }
    }
    return null;
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

function removeDuplicates(news) {
    const seen = new Set();
    return news.filter(item => {
        const key = item.title.toLowerCase().substring(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderNews() {
    const filtered = currentSection === "all"
        ? allNews
        : allNews.filter(item => item.region === currentSection);

    newsContainer.innerHTML = "";

    if (filtered.length === 0) {
        noNews.style.display = "block";
    } else {
        noNews.style.display = "none";
    }

    filtered.forEach(item => {
        const card = createNewsCard(item);
        newsContainer.appendChild(card);
    });
}

function createNewsCard(item) {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = item.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const regionLabels = {
        spain: "España",
        europe: "Europa",
        world: "Mundo"
    };

    const date = formatDate(item.date);
    const description = item.description.length > 200
        ? item.description.substring(0, 200) + "..."
        : item.description;

    card.innerHTML = `
        <div class="card-header">
            <span class="card-source">${escapeHtml(item.source)}</span>
            <span class="card-region region-${item.region}">${regionLabels[item.region]}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        ${description ? `<p class="card-description">${escapeHtml(description)}</p>` : ""}
        <div class="card-footer">
            <span class="card-date">${date}</span>
            <span class="card-link">Leer más →</span>
        </div>
    `;

    return card;
}

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

        return date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    } catch {
        return "Reciente";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
