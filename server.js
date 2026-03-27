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
                const newsItems = items.slice(0, 20).map(item => ({
                    title: item.title || '',
                    description: item.contentSnippet || item.content || '',
                    image: item.enclosure?.url || extractImageFromHTML(item.content || '') || null,
                    link: item.link || '#',
                    date: item.pubDate || item.isoDate || new Date().toISOString(),
                    source: feed.name,
                    region: feed.region
                })).filter(item => item.title);

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

// Helper function to extract image from HTML
function extractImageFromHTML(html) {
    if (!html) return null;
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🛡️ CyberNews Server running at http://localhost:${PORT}`);
});
