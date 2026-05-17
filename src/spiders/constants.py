SOURCE_NAMES = {
    'sufe': '上海财经大学',
    'cufe': '中央财经大学',
    'uibe': '对外经济贸易大学',
    'swufe': '西南财经大学',
    'dufe': '东北财经大学',
    'jxufe': '江西财经大学',
    'zuel': '中南财经政法大学',
}

SPIDERS = {source: source for source in SOURCE_NAMES.keys()}

DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
]

COMPANY_SUFFIXES = [
    "招聘简章", "校园招聘", "社会招聘", "实习生招聘", "2026届", "2025届",
    "2024届", "2026年", "2025年", "2024年", "招聘公告", "招聘启事",
    "校招", "秋招", "春招", "宣讲会", "招聘信息",
]

MAX_VISITED_URLS = 50000
VISITED_URLS_CLEANUP_RATIO = 0.3
BATCH_SIZE = 50
MAX_BROWSER_CONCURRENCY = 3
