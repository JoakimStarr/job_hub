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
            "title": ["zwmc", "zpzt"],
            "company": "dwmc",
            "location": ["gzszxmc", "gzszssmc", "szxmc"],
            "salary": "yxmc",
            "publish_date": "fbrq",
            "deadline": "zpjzrq",
            "industry": "hyyjmc",
            "education": "xlyqmc",
            "requirements": "zyyqmc",
            "description": ["zwms", "dwjs"],
            "job_type": "gzlxmc",
            "recruit_count": "xqrs",
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
            "title": "jobName",
            "company": "companyName",
            "location": ["area", "workCity"],
            "salary": "salary",
            "publish_date": "createTime",
            "education": "education",
            "requirements": "zpdxjtj",
            "industry": "nature",
            "description": ["zpgw", "xcfl"],
            "contact": ["recruitContact", "recruitMobile", "lxfs"],
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
            "education": "recruitmentPositionList[0].studentType",
            "requirements": "recruitmentPositionList[0].majorName",
            "industry": "corporationinfo.corporationNatureValue",
            "description": ["positionDescription", "shortContent", "content"],
            "job_type": "positionTypeValue",
            "apply_url": "onlineApplicationUrl",
            "contact": "resumeReceiveEmail",
            "tags": "labelValue",
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
        "date_filter_months": 2,
        "list_url_pattern": "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "selectors": {
            "list_container": "div.listb.J_allListBox",
            "list_items": "div.td-j-name",
            "list_item_row": "div.yli",
            "list_detail": "div.detail",
            "publish_time_label": "div.txt2",
            "title": "div.j-n-txt",
            "publish_date": "div.job_date span.cutom_font",
            "salary": "div.job_msg span",
            "location": "div.job_msg span",
            "education": "div.job_msg span",
            "company": "div.com-name",
            "industry": "div.com-class",
            "com_num": "div.com-num",
            "tags": "div.lab div.li",
            "description": "div.describe div.txt",
            "requirements": "div.describe",
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
    "zjgsu": {
        "name": "zjgsu_jobs",
        "university": "浙江工商大学",
        "base_url": "https://jyw.zjgsu.edu.cn",
        "location": "杭州",
        "spider_type": "api_post",
        "page_size": 10,
        "max_pages_per_section": 50,
        "detail_concurrency": 4,
        "sections": [
            {
                "section": "zpxx",
                "label": "招聘信息",
                "list_url": "/career/zpxx/search/zpxx",
                "view_url": "/career/zpxx/view/zpxx/{item_id}",
                "referer": "/career/zpxx/zpxx",
                "job_type": "全职",
            },
            {
                "section": "sxzpxx",
                "label": "实习信息",
                "list_url": "/career/zpxx/search/sxzpxx",
                "view_url": "/career/zpxx/view/sxzpxx/{item_id}",
                "referer": "/career/zpxx/sxzpxx",
                "job_type": "实习",
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
            "location": ["szxmc", "szsmc"],
            "industry": "hyyjmc",
            "company_type": "xzyjmc",
            "company_size": "rsgmmc",
            "publish_date": "fbrq",
            "deadline": "zpjzrq",
            "recruit_count": "xqrs",
            "contact_email": "jltdyx",
            "views": "djs",
        },
    },
    "cueb": {
        "name": "cueb_jobs",
        "university": "首都经济贸易大学",
        "base_url": "https://jy.cueb.edu.cn",
        "location": "北京",
        "spider_type": "api_post",
        "list_api": "https://jy.cueb.edu.cn/front/zp_query/zpxxQuery.do",
        "detail_url_pattern": "https://jy.cueb.edu.cn/front/zpxx.jspa?tid={tid}",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1", "job_type": "全职"},
            {"label": "实习", "type": "2", "job_type": "实习"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://jy.cueb.edu.cn/front/channel.jspa?channelId=764&parentId=625",
        },
        "field_mapping": {
            "title": "title",
            "company": "dwmc",
            "location": "dwszddm",
            "publish_date": "createTime",
            "views": "click",
        },
    },
    "tencent": {
        "name": "tencent_jobs",
        "university": "腾讯",
        "base_url": "https://careers.tencent.com",
        "location": "全国",
        "spider_type": "api_get",
        "list_api": "https://careers.tencent.com/tencentcareer/api/post/Query",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://careers.tencent.com/search.html",
        },
        "field_mapping": {
            "title": "RecruitPostName",
            "company": "BGName",
            "location": "LocationName",
            "category": "CategoryName",
            "description": "Responsibility",
            "publish_date": "LastUpdateTime",
            "experience": "RequireWorkYearsName",
            "apply_url": "PostURL",
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


def get_lite_http_sources():
    """
    从 SPIDER_CONFIGS 提取 HTTP 类型数据源的简化配置，供 lite_crawler 使用。

    返回格式与 lite_crawler.py 的 HTTP_SOURCES 兼容：
    {
        "source_key": {
            "name": "大学名",
            "base_url": "...",
            "list_url": "...",
            "detail_url": "...",
            "field_mapping": {...},
        }
    }
    """
    lite_sources = {}

    for key, config in SPIDER_CONFIGS.items():
        spider_type = config.get("spider_type", "")

        if spider_type == "api_post":
            sections = config.get("sections")
            if sections:
                # 优先使用 detail_url，如果没有则使用 view_url
                detail_url = sections[0].get("detail_url") or sections[0].get("view_url", "")
                lite_sources[key] = {
                    "name": config["university"],
                    "base_url": config["base_url"],
                    "list_url": sections[0]["list_url"],
                    "detail_url": detail_url,
                    "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                      for k, v in config.get("field_mapping", {}).items()},
                }
            else:
                fm = config.get("field_mapping", {})
                if fm == "same_as_cufe":
                    fm = SPIDER_CONFIGS["cufe"]["field_mapping"]
                # 支持 list_api_path 或 list_api
                list_url = config.get("list_api_path") or config.get("list_api", "")
                detail_url = config.get("detail_api_path") or config.get("detail_url_pattern", "")
                lite_sources[key] = {
                    "name": config["university"],
                    "base_url": config["base_url"],
                    "list_url": list_url,
                    "detail_url": detail_url,
                    "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                      for k, v in fm.items()},
                }

        elif spider_type == "api_get":
            list_api = config.get("list_api", "")
            detail_api = config.get("detail_api", "")
            # 对于腾讯这类不需要详情API的源
            if detail_api:
                detail_url = detail_api.replace(config["base_url"], "") + "?id={id}"
            else:
                detail_url = ""
            lite_sources[key] = {
                "name": config["university"],
                "base_url": config["base_url"],
                "list_url": list_api,
                "detail_url": detail_url,
                "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                  for k, v in config.get("field_mapping", {}).items()},
            }

    lite_sources["swufe"] = {
        "name": "西南财经大学",
        "base_url": "https://job3.swufe.edu.cn",
        "list_url_pattern": "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm",
        "field_mapping": {
            "title": "position_name",
            "company": "company",
            "location": "location",
            "salary": "salary",
            "education": "education",
            "description": "description",
            "requirements": "requirements",
            "contact": "contact",
            "industry": "industry",
            "publish_date": "publish_date",
        },
    }

    return lite_sources
