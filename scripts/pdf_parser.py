#!/usr/bin/env python3
import sys
import os
import json
import re
import tempfile

def extract_with_ocr(filepath):
    """使用OCR提取扫描版PDF的文字"""
    try:
        from pdf2image import convert_from_path
        import pytesseract
        
        print("检测到扫描版PDF，使用OCR提取文字...", file=sys.stderr)
        
        images = convert_from_path(filepath, dpi=200)
        text_parts = []
        total_chars = 0
        
        for i, image in enumerate(images):
            print(f"正在OCR识别第 {i+1}/{len(images)} 页...", file=sys.stderr)
            
            # 使用中文+英文语言包
            text = pytesseract.image_to_string(image, lang='chi_sim+eng')
            if text and text.strip():
                cleaned = text.strip()
                text_parts.append(cleaned)
                total_chars += len(cleaned)
        
        return '\n\n'.join(text_parts), len(text_parts), total_chars
        
    except ImportError as e:
        raise ImportError(f"缺少OCR依赖: {e}\n请安装: pip install pdf2image pytesseract\n并确保系统已安装 tesseract-ocr 和 tesseract-chi-sim")
    except Exception as e:
        raise Exception(f"OCR提取失败: {e}")

def extract_pdf_text(filepath):
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(filepath)
    text_parts = []
    total_chars = 0
    has_text_layer = False

    for page_idx in range(len(pdf)):
        page = pdf[page_idx]
        
        try:
            textpage = page.get_textpage()
            text = textpage.get_text_range()
            
            if text and text.strip():
                has_text_layer = True
                cleaned_page = text.strip()
                text_parts.append(cleaned_page)
                total_chars += len(cleaned_page)
        except Exception as e:
            print(f"Warning: Error on page {page_idx}: {e}", file=sys.stderr)
            continue

    pdf.close()
    
    # 如果没有提取到文字，可能是扫描版，尝试OCR
    if not has_text_layer or total_chars < 50:
        print("未检测到文本层或文本过少，尝试OCR...", file=sys.stderr)
        ocr_text, ocr_pages, ocr_chars = extract_with_ocr(filepath)
        if ocr_text and ocr_chars > 50:
            return ocr_text, ocr_pages, ocr_chars, True
    
    full_text = '\n\n'.join(text_parts).strip()
    
    # 清理文本
    cleaned = re.sub(r'[^\u0020-\u007E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', ' ', full_text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    return cleaned, len(text_parts), total_chars, False

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python pdf_parser.py <pdf_file_path>'
        }))
        sys.exit(0)

    filepath = sys.argv[1]

    if not os.path.exists(filepath):
        print(json.dumps({
            'success': False,
            'error': f'File not found: {filepath}'
        }))
        sys.exit(0)

    try:
        text, pages, raw_length, used_ocr = extract_pdf_text(filepath)
        
        result = {
            'text': text,
            'raw_length': raw_length,
            'cleaned_length': len(text),
            'pages': pages,
            'success': True,
            'used_ocr': used_ocr,
        }
        print(json.dumps(result, ensure_ascii=False))
        
    except ImportError as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'need_install': True
        }, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }, ensure_ascii=False))
        sys.exit(0)

if __name__ == '__main__':
    main()