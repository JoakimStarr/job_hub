"""
浏览器爬虫包装器
将浏览器爬虫集成到统一系统中
"""

import argparse
import asyncio
from datetime import datetime
import sys
import importlib.util
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

BROWSER_SPIDERS_AVAILABLE = False
UibeJobSpider = None
JxufeJobSpider = None
BROWSER_SOURCE_ORDER = ["uibe", "jxufe"]

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
    logger.debug("Playwright已安装")
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.debug("Playwright未安装，浏览器爬虫不可用")

if PLAYWRIGHT_AVAILABLE:
    spiders_dir = Path(__file__).parent
    constants_path = spiders_dir / "constants.py"
    utils_path = spiders_dir / "utils.py"
    base_path = spiders_dir / "base.py"
    
    constants_module = None
    utils_module = None
    base_module = None
    
    def load_module_from_file(module_name: str, file_path: Path, aliases: Optional[List[str]] = None):
        """从文件加载模块"""
        try:
            spec = importlib.util.spec_from_file_location(module_name, file_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                for name in {module_name, file_path.stem, *(aliases or [])}:
                    sys.modules[name] = module
                spec.loader.exec_module(module)
                return module
        except Exception as e:
            logger.warning(f"加载模块 {module_name} 失败: {e}")
        return None
    
    if constants_path.exists():
        logger.debug(f"加载constants模块: {constants_path}")
        constants_module = load_module_from_file("spiders_constants", constants_path, aliases=["constants", "spiders.constants"])
        if constants_module:
            logger.success("constants模块加载成功")
    else:
        logger.warning(f"constants模块不存在: {constants_path}")
    
    if constants_module and utils_path.exists():
        logger.debug(f"加载utils模块: {utils_path}")
        utils_module = load_module_from_file("spiders_utils", utils_path, aliases=["utils", "spiders.utils"])
        if utils_module:
            logger.success("utils模块加载成功")
    else:
        logger.warning(f"utils模块不存在或constants未加载: {utils_path}")
    
    if constants_module and utils_module and base_path.exists():
        logger.debug(f"加载base模块: {base_path}")
        base_module = load_module_from_file("spiders_base", base_path, aliases=["base", "spiders.base"])
        if base_module:
            logger.success("base模块加载成功")
    else:
        logger.warning(f"base模块不存在或依赖未加载: {base_path}")
    
    if base_module:
        sys.path.insert(0, str(spiders_dir))
        
        spider_files = {
            "uibe": spiders_dir / "uibe.py",
            "jxufe": spiders_dir / "jxufe_spider.py",
        }
        
        loaded_spiders = {}
        
        for name, file_path in spider_files.items():
            if file_path.exists():
                logger.debug(f"加载爬虫文件: {file_path}")
                
                module_name = f"{name}_spider_dynamic"
                spider_module = load_module_from_file(module_name, file_path)
                
                if spider_module:
                    spider_cls_name = f"{name.capitalize()}JobSpider" if name != "smartedu" else "SmartEduJobSpider"
                    if hasattr(spider_module, spider_cls_name):
                        loaded_spiders[name] = getattr(spider_module, spider_cls_name)
                        logger.success(f"成功加载爬虫: {spider_cls_name}")
                    else:
                        for attr_name in dir(spider_module):
                            if 'Spider' in attr_name and not attr_name.startswith('_'):
                                loaded_spiders[name] = getattr(spider_module, attr_name)
                                logger.success(f"找到并加载爬虫类: {attr_name}")
                                break
                else:
                    logger.error(f"爬虫模块加载失败: {file_path}")
            else:
                logger.warning(f"爬虫文件不存在: {file_path}")
        
        if loaded_spiders:
            UibeJobSpider = loaded_spiders.get("uibe")
            JxufeJobSpider = loaded_spiders.get("jxufe")
            
            if any([UibeJobSpider, JxufeJobSpider]):
                BROWSER_SPIDERS_AVAILABLE = True
                logger.success(f"浏览器爬虫加载成功，共 {len(loaded_spiders)} 个")
            else:
                logger.error("没有成功加载任何浏览器爬虫")
        else:
            logger.error("所有浏览器爬虫加载失败")
    else:
        logger.error("base模块加载失败，无法加载浏览器爬虫")


async def run_browser_spider(source: str, max_items: int = 0, headless: bool = True) -> List[Any]:
    """
    运行浏览器爬虫
    
    Args:
        source: 数据源名称
        max_items: 最大爬取数量
        headless: 是否无头模式
    
    Returns:
        岗位数据列表
    """
    if not PLAYWRIGHT_AVAILABLE:
        logger.error(
            f"[{source}] Playwright未安装，请执行:\n"
            f"  pip install playwright\n"
            f"  playwright install chromium"
        )
        return []
    
    if not BROWSER_SPIDERS_AVAILABLE:
        logger.error(
            f"[{source}] 浏览器爬虫加载失败\n"
            f"请检查爬虫文件是否存在"
        )
        return []
    
    spider_map = {
        "uibe": UibeJobSpider,
        "jxufe": JxufeJobSpider,
    }
    
    spider_cls = spider_map.get(source)
    if not spider_cls:
        logger.error(f"[{source}] 未知的浏览器爬虫")
        return []
    
    try:
        logger.info(f"[{source}] 启动浏览器爬虫...")
        spider = spider_cls(headless=headless)
        jobs = await spider.crawl(max_items=max_items)
        logger.success(f"[{source}] 浏览器爬虫完成: {len(jobs)} 条")
        return jobs
    except Exception as e:
        logger.error(f"[{source}] 浏览器爬虫执行失败: {e}")
        import traceback
        traceback.print_exc()
        return []


def list_available_sources() -> List[str]:
    """获取已加载的浏览器爬虫数据源"""
    spider_map = {
        "uibe": UibeJobSpider,
        "jxufe": JxufeJobSpider,
    }
    return [source for source in BROWSER_SOURCE_ORDER if spider_map.get(source)]


async def run_browser_spiders(sources: Optional[List[str]] = None, max_items: int = 0, headless: bool = True) -> Dict[str, List[Any]]:
    """运行一个或多个浏览器爬虫"""
    selected_sources = sources or list_available_sources()
    results: Dict[str, List[Any]] = {}
    start_time = datetime.now()

    for source in selected_sources:
        jobs = await run_browser_spider(source, max_items=max_items, headless=headless)
        results[source] = jobs

    elapsed = (datetime.now() - start_time).total_seconds()
    total_jobs = sum(len(jobs) for jobs in results.values())
    print("\n" + "=" * 60)
    print(f"浏览器爬取完成 | 总耗时 {elapsed:.1f}s")
    print(f"  总岗位数: {total_jobs}")
    print(f"  完成源: {len(results)}/{len(selected_sources)}")
    print("-" * 60)
    for source, jobs in results.items():
        print(f"  {source:10s} | {len(jobs):4d} 条")
    print("=" * 60)
    return results


def is_browser_spider_available() -> bool:
    """检查浏览器爬虫是否可用"""
    return BROWSER_SPIDERS_AVAILABLE


def main():
    parser = argparse.ArgumentParser(description="浏览器爬虫运行入口")
    parser.add_argument("--sources", nargs="*", help="指定浏览器爬虫 (如: smartedu uibe jxufe neu)")
    parser.add_argument("--list-sources", action="store_true", help="列出可用浏览器爬虫")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式运行浏览器 (默认)")
    parser.add_argument("--no-headless", dest="no_headless", action="store_true", help="显示浏览器窗口")
    parser.add_argument("--max-items", type=int, default=0, help="每个数据源最大爬取数量 (0=不限)")
    args = parser.parse_args()

    headless = not args.no_headless

    if args.list_sources:
        print("\n可用浏览器爬虫:")
        if not BROWSER_SPIDERS_AVAILABLE:
            print("  无可用爬虫")
            return
        for source in list_available_sources():
            print(f"  {source}")
        return

    if not BROWSER_SPIDERS_AVAILABLE:
        print("\n浏览器爬虫不可用，请检查:")
        print("  1. Playwright是否安装: pip install playwright && playwright install chromium")
        print("  2. 爬虫文件是否存在")
        print("  3. base.py、utils.py、constants.py是否存在: next-app/src/spiders/")
        return

    selected_sources = args.sources or list_available_sources()
    invalid = [source for source in selected_sources if source not in BROWSER_SOURCE_ORDER]
    if invalid:
        print(f"错误: 未知浏览器爬虫: {', '.join(invalid)}")
        print(f"可用: {', '.join(list_available_sources())}")
        raise SystemExit(1)

    asyncio.run(run_browser_spiders(sources=selected_sources, max_items=args.max_items, headless=headless))


if __name__ == "__main__":
    main()
