"""
shared_parsers - 共用解析函数

供主爬虫(HtmlStrategy)和lite_crawler共同使用，确保字段匹配规则一致。
lite_crawler保持单线程同步调用，主爬虫使用异步方式。
"""

import re
from typing import Optional, Dict

from bs4 import BeautifulSoup

from .utils import normalize_publish_date, clean_company_name, truncate_text


def parse_swufe_detail(html: str, url: str, source: str, university: str,
                       location_default: str = "成都") -> Optional[Dict]:
    """
    解析SWUFE详情页HTML为岗位字典

    字段匹配规则（主爬虫和lite_crawler共用）:
    - title: 格式为 "岗位名 | 公司名"
    - company: div.com-name（优先从 new-se-main 查找）
    - location: div.job_msg span（工作地）
    - salary: div.job_msg span（薪酬）
    - education: div.job_msg span（学历）
    - industry: div.com-class
    - description: 从多个 div.describe 中提取（职位描述等）
    - requirements: 从 div.describe 中提取（投递要求等）
    - contact: 从页面文本提取邮箱和电话
    - publish_date: div.job_date span.cutom_font
    - tags: div.lab div.li

    Args:
        html: HTML文本内容
        url: 页面URL
        source: 数据源标识
        university: 大学名称
        location_default: 默认工作地点

    Returns:
        岗位字典或None (如果页面无效或解析失败)
    """
    try:
        soup = BeautifulSoup(html, "lxml")

        no_page = soup.find("div", class_="no_page_group")
        if no_page:
            del soup
            return None

        # 查找主容器 - 优先级: new-se-main > main > jobsshow > soup
        new_se_main = soup.find('div', class_='new-se-main')
        main_div = soup.find('div', class_='main')
        jobsshow = soup.find('div', class_='jobsshow')

        # 提取岗位名称 - 优先从 new-se-main 查找
        position_name = ""
        if new_se_main:
            jobname_elem = new_se_main.find('div', class_='jobname')
            if jobname_elem:
                j_n_txt = jobname_elem.find('div', class_='j-n-txt')
                position_name = j_n_txt.get_text(strip=True) if j_n_txt else ""

        if not position_name:
            del soup
            return None

        # 提取发布时间 - 优先从 new-se-main 查找
        publish_date_str = ""
        if new_se_main:
            job_date = new_se_main.find('div', class_='job_date')
            if job_date:
                date_span = job_date.find('span', class_='cutom_font')
                if date_span:
                    publish_date_str = date_span.get_text(strip=True)[:10]

        publish_date = normalize_publish_date(publish_date_str) if publish_date_str else ""

        # 提取薪资、学历、工作地点 - 优先从 new-se-main 的 job_msg 查找
        salary = "面议"
        education = ""
        location = ""

        search_container = new_se_main or soup
        job_msg = search_container.find('div', class_='job_msg')
        if job_msg:
            for span in job_msg.find_all('span'):
                span_text = span.get_text(strip=True)
                if '薪酬：' in span_text:
                    salary_txt = span_text.replace('薪酬：', '')
                    if salary_txt:
                        salary = salary_txt
                elif '学历：' in span_text:
                    edu_txt = span_text.replace('学历：', '')
                    if edu_txt:
                        education = edu_txt
                elif '工作地：' in span_text:
                    loc_txt = span_text.replace('工作地：', '')
                    if loc_txt:
                        location = loc_txt

        # 提取公司信息 - 优先从 new-se-main 查找
        company = ""
        industry = ""

        if new_se_main:
            job_com = new_se_main.find('div', class_='job-com')
            if job_com:
                com_name = job_com.find('div', class_='com-name')
                if com_name:
                    # 移除 HTML 注释
                    for comment in com_name.find_all(string=lambda text: isinstance(text, str) and '<!--' in text):
                        comment.extract()
                    company = com_name.get_text(strip=True)

                com_class = job_com.find('div', class_='com-class')
                if com_class:
                    industry = com_class.get_text(strip=True)

        # 如果 new-se-main 中没有找到公司名，尝试 main_div
        if not company and main_div:
            com_name_alt = main_div.find('div', class_='com-name')
            if com_name_alt:
                company = com_name_alt.get_text(strip=True)

        company = clean_company_name(company.lstrip(">").strip()) if company else "未知公司"

        # title格式: 岗位 | 公司
        title = f"{position_name} | {company}" if position_name and company else (position_name or company)

        # 提取职位描述和投递要求 - 从 main_div 或 jobsshow 查找 describe
        description_parts = []
        requirements = ""

        describe_container = main_div or jobsshow or soup
        describe_divs = describe_container.find_all('div', class_='describe')

        for desc_div in describe_divs:
            tit = desc_div.find('div', class_='tit')
            if tit:
                tit_text = tit.get_text(strip=True)
                txt = desc_div.find('div', class_='txt')
                req = desc_div.find('div', class_='req')

                if '职位描述' in tit_text and txt:
                    description_parts.append(f"【职位描述】{txt.get_text(strip=True)}")
                elif '投递' in tit_text or '要求' in tit_text:
                    req_text = ""
                    if req:
                        req_text = req.get_text(strip=True)
                    elif txt:
                        req_text = txt.get_text(strip=True)
                    if not req_text:
                        req_text = desc_div.get_text(strip=True).replace(tit_text, '').strip()
                    if req_text:
                        requirements = req_text

        # 如果没有从 describe divs 提取到 description，回退到单 div.describe div.txt
        if not description_parts:
            desc_el = describe_container.select_one("div.describe div.txt")
            if desc_el:
                description_parts.append(desc_el.get_text(strip=True))

        # 提取联系方式 - 从整个页面文本
        contact_parts = []
        page_text = soup.get_text()

        email_match = re.search(r'[\w.-]+@[\w.-]+\.\w+', page_text)
        if email_match:
            contact_parts.append(f"邮箱: {email_match.group()}")

        phone_match = re.search(r'1[3-9]\d{9}', page_text)
        if phone_match:
            contact_parts.append(f"电话: {phone_match.group()}")

        contact = " | ".join(contact_parts)

        # 提取标签
        tags = []
        for tag_el in soup.select("div.lab div.li"):
            tag_text = tag_el.get_text(strip=True)
            if tag_text:
                tags.append(tag_text)
        tags_str = ",".join(tags) if tags else ""

        # 合并描述
        description = "\n\n".join(description_parts)

        del soup

        return {
            "title": title,
            "company": company,
            "location": location or location_default,
            "description": truncate_text(description) or title,
            "salary": salary,
            "requirements": requirements,
            "industry": industry,
            "education": education,
            "experience": "",
            "contact": contact,
            "publish_date": publish_date,
            "tags": tags_str,
            "source": source,
            "university": university,
            "source_url": url,
            "apply_url": url,
        }

    except Exception as e:
        return None


def parse_swufe_list_date(item, cutoff_date=None):
    """
    从SWUFE列表页项中解析发布时间并判断是否过期

    Args:
        item: BeautifulSoup的列表项元素 (div.td-j-name)
        cutoff_date: datetime对象，过期截止日期。None表示不过期检查

    Returns:
        元组 (publish_date_str, is_expired):
        - publish_date_str: 发布日期字符串 (YYYY-MM-DD)
        - is_expired: 是否已过期
    """
    from datetime import datetime, timedelta

    publish_date_str = ""
    is_expired = False

    job_row = item.find_parent('div', class_='yli')
    if not job_row:
        return publish_date_str, is_expired

    detail_div = job_row.find('div', class_='detail')
    if not detail_div:
        return publish_date_str, is_expired

    for span in detail_div.find_all('span'):
        txt2 = span.find('div', class_='txt2')
        if txt2 and '发布时间' in txt2.get_text():
            publish_text = span.get_text(strip=True).replace('发布时间：', '')

            if '小时前' in publish_text or '天前' in publish_text or '分钟前' in publish_text:
                is_expired = False
                num_match = re.search(r'(\d+)', publish_text)
                if num_match:
                    days_ago = int(num_match.group(1))
                    if '小时前' in publish_text or '分钟前' in publish_text:
                        days_ago = 0
                    publish_date = datetime.now() - timedelta(days=days_ago)
                    publish_date_str = publish_date.strftime('%Y-%m-%d')
            else:
                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', publish_text)
                if date_match:
                    publish_date_str = date_match.group(1)
                    if cutoff_date:
                        try:
                            publish_date = datetime.strptime(publish_date_str, '%Y-%m-%d')
                            if publish_date < cutoff_date:
                                is_expired = True
                        except ValueError:
                            pass
            break

    return publish_date_str, is_expired
