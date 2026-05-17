"""
统一爬虫配置文件
根据SPIDERS_TECH_DOC.md定义各数据源的爬取配置
"""

from typing import Dict, Any, List

SPIDER_CONFIGS: Dict[str, Dict[str, Any]] = {
    "sufe": {
        "name": "sufe_jobs",
        "university": "上海财经大学",
        "base_url": "https://career.sufe.edu.cn",
        "location": "上海",
        "spider_type": "api_post",
        "page_size": 10,
        "max_pages_per_section": 5,
        "detail_concurrency": 8,
        "sections": [
            {
                "section": "zpxx",
                "label": "招聘信息",
                "list_url": "/career//zpxx/search/zpxx",
                "detail_url": "/career//zpxx/data/zpxx/{item_id}",
                "view_url": "/career/zpxx/view/zpxx/{item_id}",
                "referer": "/career/zpxx/zpxx",
            },
            {
                "section": "sxzpxx",
                "label": "实习信息",
                "list_url": "/career//zpxx/search/sxzpxx",
                "detail_url": "/career//zpxx/data/sxzpxx/{item_id}",
                "view_url": "/career/zpxx/view/sxzpxx/{item_id}",
                "referer": "/career/zpxx/sxzpxx",
            },
            {
                "section": "zpgg",
                "label": "招聘公告",
                "list_url": "/career//news/search/zpgg",
                "detail_url": "/career//news/data/{news_type}/{item_id}",
                "view_url": "/career/news/view/{news_type}/{item_id}",
                "referer": "/career/news/zpgg",
            },
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": "zpzt",
            "company": "dwmc",
            "location": ["gzszxmc", "szxmc"],
            "salary": "yxmc",
            "publish_date": "fbrq",
            "deadline": "zpjzrq",
            "industry": "hyyjmc",
            "education": "xlyqmc",
            "requirements": "zyyqmc",
            "description": ["zwms", "dwjs"],
            "job_type": "gzlxmc",
        },
    },
    "zuel": {
        "name": "zuel_jobs",
        "university": "中南财经政法大学",
        "base_url": "https://jyzx.zuel.edu.cn",
        "location": "武汉",
        "spider_type": "api_get",
        "list_api": "https://jyzx.zuel.edu.cn/api/publicly/recruit/list",
        "detail_api": "https://jyzx.zuel.edu.cn/api/publicly/recruit/get",
        "page_size": 10,
        "max_pages_per_category": 80,
        "detail_concurrency": 8,
        "categories": [
            {"label": "全职", "api_type": "1", "job_type": "全职"},
            {"label": "实习", "api_type": "2", "job_type": "实习"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "field_mapping": {
            "title": "title",
            "company": "companyName",
            "location": "area",
            "salary": "salary",
            "publish_date": "createTime",
            "education": "education",
            "requirements": "majors",
            "industry": "nature",
            "description": ["companyContent", "dwjj", "zpgw"],
        },
    },
    "cufe": {
        "name": "cufe_jobs",
        "university": "中央财经大学",
        "base_url": "http://scc.cufe.edu.cn",
        "location": "北京",
        "spider_type": "api_post",
        "list_api_path": "/f/recruitmentinfo/ajax_frontRecruitinfo",
        "detail_api_path": "/f/recruitmentinfo/ajax_show",
        "page_size": 10,
        "max_pages": 80,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1"},
            {"label": "实习", "type": "2"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": "title",
            "company": "corporationinfo.name",
            "location": "recruitmentPositionList[0].cityName",
            "publish_date": "startTime",
            "deadline": "endTime",
            "education": "education",
            "requirements": "majorName",
            "industry": "corporationinfo.corporationNatureValue",
            "description": ["content", "corporationinfo.introduction"],
            "job_type": "positionTypeValue",
            "apply_url": "onlineApplicationUrl",
        },
    },
    "dufe": {
        "name": "dufe_jobs",
        "university": "东北财经大学",
        "base_url": "https://career.dufe.edu.cn",
        "location": "大连",
        "spider_type": "api_post",
        "list_api_path": "/f/recruitmentinfo/ajax_frontRecruitinfo",
        "detail_api_path": "/f/recruitmentinfo/ajax_show",
        "page_size": 10,
        "max_pages": 80,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1"},
            {"label": "实习", "type": "2"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": "same_as_cufe",
    },
    "swufe": {
        "name": "swufe_jobs",
        "university": "西南财经大学",
        "base_url": "https://job3.swufe.edu.cn",
        "location": "成都",
        "spider_type": "html",
        "page_size": 10,
        "max_pages": 100,
        "detail_concurrency": 8,
        "url_patterns": {
            "fulltime": {
                "pattern": "https://job3.swufe.edu.cn/jobs/jobs-show-{id}-.htm",
                "start_id": 14506,
                "job_type": "全职",
            },
            "intern": {
                "pattern": "https://job3.swufe.edu.cn/interns/interns_show/id/{id}.htm",
                "start_id": 12250,
                "job_type": "实习",
            },
        },
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "selectors": {
            "title": "div.j-n-txt",
            "publish_date": "div.job_date span.cutom_font",
            "salary": "div.job_msg span",
            "location": "span.job_position",
            "education": "span.job_academic",
            "experience": "span.job_money",
            "company": "div.com-name",
            "industry": "div.com-class",
            "com_num": "div.com-num",
            "tags": "div.lab div.li",
            "description": "div.describe div.txt",
            "not_found": "div.no_page_group",
        },
    },
    "uibe": {
        "name": "uibe_jobs",
        "university": "对外经济贸易大学",
        "base_url": "https://career.uibe.edu.cn",
        "location": "北京",
        "spider_type": "browser_js",
        "list_url": "/front/channel.jspa?channelId=764&parentId=625",
        "detail_url_pattern": "/front/zpxx.jspa?tid={tid}",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "selectors": {
            "list_links": "a[href*='/front/zpxx.jspa?tid=']",
            "detail_title": "h1",
            "detail_content": "div.details-content",
        },
    },
    "jxufe": {
        "name": "jxufe_jobs",
        "university": "江西财经大学现代经济管理学院",
        "base_url": "http://career.jxufe.edu.cn",
        "location": "南昌",
        "spider_type": "browser_js",
        "list_url": "/module/onlines?type=1&menu_id=5538",
        "detail_url_pattern": "/detail/online?id={id}",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "selectors": {
            "list_links": "a[href*='/detail/online?id=']",
            "detail_title": "h1",
            "detail_content": "div.details-content",
        },
    },
}

SPIDER_CONFIGS_DISABLED = {
    "smartedu": {
        "name": "smartedu_jobs",
        "university": "国家大学生就业服务平台",
        "base_url": "https://24365.smartedu.cn",
        "location": "全国",
        "spider_type": "browser_api",
        "list_api": "https://24365.smartedu.cn/student/jobs/jobslist/ajax/",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 8,
        "headers": {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": "jobName",
            "company": "recName",
            "location": "areaCodeName",
            "salary": ["lowMonthPay", "highMonthPay"],
            "publish_date": "publishDate",
            "education": "degreeName",
            "requirements": "major",
            "industry": "recProperty",
            "description": ["major", "recScale", "recProperty"],
        },
    },
    "neu": {
        "name": "neu_jobs",
        "university": "东北大学",
        "base_url": "http://job.neu.edu.cn",
        "location": "辽宁",
        "spider_type": "browser_js",
        "list_url": "/campus",
        "detail_url_pattern": "/campus/view/id/{id}",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "selectors": {
            "list_links": "a[href*='/campus/view/id/']",
            "detail_title": ".title-message h5",
            "detail_summary": ".zp-details",
            "detail_content": ".details-mge .info",
        },
    },
}


def get_spider_config(source: str) -> Dict[str, Any]:
    """获取指定数据源的爬虫配置"""
    if source not in SPIDER_CONFIGS:
        raise ValueError(f"未知的爬虫数据源: {source}")
    return SPIDER_CONFIGS[source]


def get_all_spider_names() -> List[str]:
    """获取所有爬虫名称列表"""
    return list(SPIDER_CONFIGS.keys())


def get_spider_display_name(source: str) -> str:
    """获取爬虫的显示名称（大学名称）"""
    config = get_spider_config(source)
    return config.get("university", source)
