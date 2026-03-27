import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const parser = new Parser({
    timeout: 15000,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

const FEEDS = {
    spain: [
        { name: "INCIBE-AVISOS", url: "https://www.incibe.es/index.php/incibe-cert/alerta-temprana/avisos/feed", region: "spain" },
        { name: "INCIBE-CERT", url: "https://www.incibe.es/feed/vulnerabilities", region: "spain" },
        { name: "INCIBE-BLOG", url: "https://www.incibe.es/index.php/incibe-cert/blog/feed", region: "spain" },
        { name: "INCIBE-GUIAS", url: "https://www.incibe.es/index.php/incibe-cert/publicaciones/guias-y-estudios/feed", region: "spain"},
        { name: "HackPlayers", url: "https://www.hackplayers.com/feeds/posts/default?alt=rss", region: "spain" },
        { name: "Una al Día (Hispasec)", url: "https://unaaldia.hispasec.com/feed", region: "spain" },
        { name: "CyberSecurity News ES", url: "https://cybersecuritynews.es/feed/", region: "spain" }
    ],
    europe: [
        { name: "CERT-EU Threat Intelligence", url: "https://cert.europa.eu/publications/threat-intelligence-rss", region: "europe" },
        { name: "CERT-EU Security Advisories", url: "https://cert.europa.eu/publications/security-advisories-rss", region: "europe" },
        { name: "CERT-EU Security Guidance", url: "https://cert.europa.eu/publications/security-guidance-rss", region: "europe" },
        { name: "The Register - Security", url: "https://www.theregister.com/security/headlines.atom", region: "europe" },
        { name: "Graham Cluley", url: "https://grahamcluley.com/feed/", region: "europe" },
        { name: "Infosecurity Magazine", url: "https://www.infosecurity-magazine.com/rss/news/", region: "europe" },
        { name: "Computer Weekly Security", url: "https://www.computerweekly.com/rss/IT-security.xml", region: "europe" }
    ],
    world: [
        { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", region: "world" },
        { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", region: "world" },
        { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", region: "world" },
        { name: "SecurityWeek", url: "https://www.securityweek.com/feed/", region: "world" },
        { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", region: "world" },
        { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/", region: "world" },
        { name: "CISA Alerts", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", region: "world" },
        { name: "CSO Online", url: "https://www.csoonline.com/feed/", region: "world" },
        { name: "Recorded Future", url: "https://therecord.media/feed", region: "world" }
    ]
};

app.use(cors());
app.use(express.static(__dirname));

// API endpoint to fetch all feeds
app.get('/api/feeds', async (req, res) => {
    const allFeeds = [...FEEDS.spain, ...FEEDS.europe, ...FEEDS.world];
    console.log(`Cargando ${allFeeds.length} feeds...`);

    const results = await Promise.allSettled(
        allFeeds.map(feed =>
            parser.parseURL(feed.url)
                .then(parsedFeed => ({
                    feed,
                    items: parsedFeed.items || []
                }))
                .catch(err => {
                    console.warn(`❌ ${feed.name}: ${err.message}`);
                    return null;
                })
        )
    );

    let allNews = [];
    let successCount = 0;

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
            const { feed, items } = result.value;
            if (items.length > 0) {
                const newsItems = items.slice(0, 20).map(item => {
                    const originalImage = item.enclosure?.url || extractImageFromHTML(item.content || '');
                    const title = item.title || '';
                    // Generate a seed from title for consistent placeholder images
                    const seed = Math.abs(title.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
                    const svgContent = generateTechSVG(seed);
                    const placeholderImage = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

                    return {
                        title: title,
                        description: item.contentSnippet || item.content || '',
                        image: originalImage || placeholderImage,
                        link: item.link || '#',
                        date: item.pubDate || item.isoDate || new Date().toISOString(),
                        source: feed.name,
                        region: feed.region,
                        category: categorizeItem(title, item.contentSnippet || item.content || '')
                    };
                }).filter(item => item.title);

                allNews.push(...newsItems);
                successCount++;
                console.log(`✅ ${feed.name}: ${items.length} noticias`);
            }
        }
    });

    console.log(`Total: ${successCount}/${allFeeds.length} feeds, ${allNews.length} noticias`);

    // Remove duplicates
    const seen = new Set();
    allNews = allNews.filter(item => {
        const key = item.title.toLowerCase().substring(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by date
    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
        timestamp: new Date().toISOString(),
        count: allNews.length,
        successFeeds: successCount,
        totalFeeds: allFeeds.length,
        news: allNews
    });
});

// Categorize news item based on keywords
function categorizeItem(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    if (/cve|vulnerabilidad|exploit|zero.?day|0-day|rce|patch|parche|buffer overflow|sql injection|xss/.test(text)) return 'vulnerability';
    if (/ransomware|malware|trojan|backdoor|botnet|spyware|rootkit|worm|virus|stealer/.test(text)) return 'malware';
    if (/phishing|smishing|vishing|estafa|fraude|suplantaci|ingeniería social|credential|spear/.test(text)) return 'phishing';
    if (/breach|filtrac|data leak|datos expuestos|robo de datos|hackeo|compromiso|exfiltrac/.test(text)) return 'breach';
    if (/apt|threat actor|nation.?state|espionaje|advanced persistent|campaign/.test(text)) return 'apt';
    if (/gdpr|rgpd|cumplimiento|normativa|regulaci|nis2|ens|compliance|iso 27001/.test(text)) return 'compliance';
    if (/herramienta|tool|framework|pentest|red team|ctf|poc|exploit kit|scanner/.test(text)) return 'tools';
    return 'general';
}

// Helper function to extract image from HTML
function extractImageFromHTML(html) {
    if (!html) return null;
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

// Generate a tech-style SVG placeholder
function generateTechSVG(seed) {
    const colors = ['#0098D7', '#DF1A21', '#0E3062', '#17C0EB', '#FF6B6B', '#4ECDC4'];
    const color = colors[seed % colors.length];
    const bgColor = colors[(seed + 1) % colors.length];

    // Generate grid/matrix pattern
    let gridElements = '';
    const gridSize = 8;
    const cellSize = 50;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const rand = (seed + i * gridSize + j) % 3;
            if (rand === 0) {
                gridElements += `<rect x="${i * cellSize}" y="${j * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}" opacity="0.3" stroke="${color}" stroke-width="2"/>`;
            } else if (rand === 1) {
                gridElements += `<circle cx="${i * cellSize + cellSize/2}" cy="${j * cellSize + cellSize/2}" r="${cellSize/3}" fill="${color}" opacity="0.4"/>`;
            }
        }
    }

    // Add some connecting lines for tech feel
    let lines = '';
    for (let i = 0; i < 5; i++) {
        const x1 = (seed * 37 + i * 123) % 400;
        const y1 = (seed * 61 + i * 89) % 400;
        const x2 = (seed * 41 + i * 151) % 400;
        const y2 = (seed * 53 + i * 97) % 400;
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.5"/>`;
    }

    const svg = `<svg width="400" height="250" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${color};stop-opacity:0.2" />
            </linearGradient>
        </defs>
        <rect width="400" height="250" fill="url(#grad)"/>
        ${gridElements}
        ${lines}
        <text x="200" y="125" font-family="monospace" font-size="24" fill="${color}" opacity="0.6" text-anchor="middle">{}</text>
    </svg>`;

    return svg;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🛡️ CyberNews Server running at http://localhost:${PORT}`);
});
