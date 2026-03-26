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
        },
        {
            name: "Protege tu Empresa",
            url: "https://www.incibe.es/protege-tu-empresa/blog/rss",
            region: "spain"
        },
        {
            name: "HackPlayers",
            url: "https://www.hackplayers.com/feeds/posts/default?alt=rss",
            region: "spain"
        },
        {
            name: "Una al Día (Hispasec)",
            url: "https://unaaldia.hispasec.com/feed",
            region: "spain"
        },
        {
            name: "Security Art Work",
            url: "https://www.securityartwork.es/feed/",
            region: "spain"
        },
        {
            name: "CyberSecurity News ES",
            url: "https://cybersecuritynews.es/feed/",
            region: "spain"
        },
        {
            name: "Derecho de la Red",
            url: "https://derechodelared.com/feed/",
            region: "spain"
        }
    ],
    europe: [
        {
            name: "ENISA",
            url: "https://www.enisa.europa.eu/publications/rss.xml",
            region: "europe"
        },
        {
            name: "EU CERT",
            url: "https://cert.europa.eu/publications/security-advisories/rss",
            region: "europe"
        },
        {
            name: "The Register - Security",
            url: "https://www.theregister.com/security/headlines.atom",
            region: "europe"
        },
        {
            name: "Graham Cluley",
            url: "https://grahamcluley.com/feed/",
            region: "europe"
        },
        {
            name: "Infosecurity Magazine",
            url: "https://www.infosecurity-magazine.com/rss/news/",
            region: "europe"
        },
        {
            name: "Computer Weekly Security",
            url: "https://www.computerweekly.com/rss/IT-security.xml",
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
        },
        {
            name: "Naked Security (Sophos)",
            url: "https://nakedsecurity.sophos.com/feed/",
            region: "world"
        },
        {
            name: "Schneier on Security",
            url: "https://www.schneier.com/feed/atom/",
            region: "world"
        },
        {
            name: "CISA Alerts",
            url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
            region: "world"
        },
        {
            name: "CSO Online",
            url: "https://www.csoonline.com/feed/",
            region: "world"
        },
        {
            name: "Recorded Future",
            url: "https://therecord.media/feed",
            region: "world"
        },
        {
            name: "SC Magazine",
            url: "https://www.scworld.com/feed",
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
    noNews.style.display = "none";
    newsContainer.innerHTML = "";
    refreshBtn.classList.add("spinning");

    const allFeeds = [
        ...FEEDS.spain,
        ...FEEDS.europe,
        ...FEEDS.world
    ];

    console.log(`Cargando ${allFeeds.length} feeds...`);

    const results = await Promise.allSettled(
        allFeeds.map(feed => fetchFeedWithRetry(feed))
    );

    allNews = [];
    let successCount = 0;

    results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value && result.value.length > 0) {
            allNews.push(...result.value);
            successCount++;
            console.log(`✅ ${allFeeds[i].name}: ${result.value.length} noticias`);
        } else {
            console.warn(`❌ ${allFeeds[i].name}: sin resultados`);
        }
    });

    console.log(`Total: ${successCount}/${allFeeds.length} feeds, ${allNews.length} noticias`);

    // Sort by date, newest first
    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Remove duplicates
    allNews = removeDuplicates(allNews);

    loading.style.display = "none";
    refreshBtn.classList.remove("spinning");

    if (allNews.length === 0) {
        noNews.style.display = "block";
        noNews.innerHTML = `
            <p>No se pudieron cargar las noticias.</p>
            <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">
                Pulsa ⟳ para reintentar.
            </p>
        `;
    }

    // Update timestamp
    const now = new Date();
    lastUpdateTime.textContent = `Actualizado: ${now.toLocaleDateString("es-ES")} ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

    // Cache
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
                return data.items.map(item => ({
                    title: cleanText(item.title),
                    description: cleanText(item.description || item.content || ""),
                    image: item.thumbnail || item.enclosure?.link || extractImageFromHTML(item.description || item.content || ""),
                    link: item.link,
                    date: item.pubDate || new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                }));
            }
        }
    } catch (e) {
        console.log(`  ${feed.name}: rss2json falló`);
    }

    // Proxy 1 & 2: return raw XML
    for (let i = 1; i < PROXIES.length; i++) {
        try {
            const res = await fetch(PROXIES[i](feed.url), { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const text = await res.text();
                const items = parseRSS(text, feed);
                if (items && items.length > 0) {
                    return items;
                }
            }
        } catch (e) {
            console.log(`  ${feed.name}: proxy ${i} falló`);
        }
    }

    return null;
}

function parseRSS(xml, feed) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");

        if (doc.querySelector("parsererror")) return null;

        // RSS 2.0
        let items = doc.querySelectorAll("item");
        if (items.length > 0) {
            return Array.from(items).slice(0, 20).map(item => {
                const linkEl = item.querySelector("link");
                let link = "#";
                if (linkEl) {
                    link = linkEl.textContent?.trim() || linkEl.getAttribute("href") || "#";
                }
                const rawDesc = item.querySelector("description")?.textContent ||
                    getElementByTagNS(item, "encoded") || "";
                return {
                    title: cleanText(item.querySelector("title")?.textContent || ""),
                    description: cleanText(rawDesc),
                    image: getImageFromItem(item) || extractImageFromHTML(rawDesc),
                    link: link,
                    date: item.querySelector("pubDate")?.textContent ||
                          getElementByTagNS(item, "date") ||
                          new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                };
            }).filter(item => item.title);
        }

        // Atom
        const entries = doc.querySelectorAll("entry");
        if (entries.length > 0) {
            return Array.from(entries).slice(0, 20).map(entry => {
                const rawContent = entry.querySelector("summary")?.textContent ||
                    entry.querySelector("content")?.textContent || "";
                return {
                    title: cleanText(entry.querySelector("title")?.textContent || ""),
                    description: cleanText(rawContent),
                    image: getImageFromItem(entry) || extractImageFromHTML(rawContent),
                    link: entry.querySelector("link")?.getAttribute("href") ||
                          entry.querySelector("link")?.textContent || "#",
                    date: entry.querySelector("published")?.textContent ||
                          entry.querySelector("updated")?.textContent ||
                          new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                };
            }).filter(item => item.title);
        }

        return null;
    } catch {
        return null;
    }
}

// Extract image from RSS/Atom XML item (media:content, enclosure, media:thumbnail)
function getImageFromItem(item) {
    // media:content or media:thumbnail
    for (const child of item.children) {
        if ((child.localName === "content" || child.localName === "thumbnail") &&
            child.getAttribute("url")) {
            const type = child.getAttribute("type") || "";
            const url = child.getAttribute("url");
            if (!type || type.startsWith("image")) return url;
        }
    }
    // enclosure with image type
    const enclosure = item.querySelector("enclosure");
    if (enclosure) {
        const type = enclosure.getAttribute("type") || "";
        if (type.startsWith("image")) return enclosure.getAttribute("url");
    }
    return null;
}

// Extract first image URL from HTML string
function extractImageFromHTML(html) {
    if (!html) return null;
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

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

    if (filtered.length === 0 && allNews.length > 0) {
        noNews.style.display = "block";
        noNews.innerHTML = `<p>No hay noticias en esta categoría.</p>`;
    } else if (filtered.length === 0) {
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

    const regionIcons = { spain: "🇪🇸", europe: "🇪🇺", world: "🌍" };

    const imageHTML = item.image
        ? `<div class="card-image"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-image-placeholder\\'>${regionIcons[item.region]}</div>'"></div>`
        : `<div class="card-image"><div class="card-image-placeholder">${regionIcons[item.region]}</div></div>`;

    card.innerHTML = `
        ${imageHTML}
        <div class="card-body">
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
